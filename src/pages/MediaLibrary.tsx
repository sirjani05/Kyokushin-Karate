import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Film, ImagePlus, Play, Plus, Trophy, Upload, X } from "lucide-react";
import { toast } from "sonner";
import type { BeltStory, Profile, TournamentVideo } from "../lib/database.types";
import type { AppDatabase } from "../lib/data";
import {
  getPublicStories,
  getPublicVideos,
  getSenseiStories,
  getSenseiVideos,
  getSignedMediaUrl,
} from "../lib/data";
import { EmptyState, ErrorState, LoadingState } from "../components/StatusView";

type MediaTab = "videos" | "stories";
const videoTypes: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
const imageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function MediaLibrary({
  client,
  profile,
}: {
  client: AppDatabase;
  profile: Profile;
}) {
  const queryClient = useQueryClient();
  const isSensei = profile.role === "sensei";
  const [tab, setTab] = useState<MediaTab>("videos");
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<TournamentVideo | null>(null);
  const [selectedStory, setSelectedStory] = useState<BeltStory | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [videoForm, setVideoForm] = useState({ title: "", description: "", event_name: "", recorded_on: "", is_published: false });
  const [storyForm, setStoryForm] = useState({ title: "", story: "", student_display_name: "", belt_from: "", belt_to: "", promoted_on: "", student_consented: false, is_published: false });

  const videos = useQuery({
    queryKey: ["videos", isSensei ? profile.id : "public"],
    queryFn: () => isSensei ? getSenseiVideos(client, profile.id) : getPublicVideos(client),
  });
  const stories = useQuery({
    queryKey: ["stories", isSensei ? profile.id : "public"],
    queryFn: () => isSensei ? getSenseiStories(client, profile.id) : getPublicStories(client),
  });
  const selectedAssetPath = selectedVideo?.storage_path ?? selectedStory?.image_path ?? null;
  const selectedBucket = selectedVideo ? "tournament-videos" : "belt-stories";
  const selectedAsset = useQuery({
    queryKey: ["media-url", selectedBucket, selectedAssetPath],
    queryFn: () => getSignedMediaUrl(client, selectedBucket, selectedAssetPath!),
    enabled: Boolean(selectedAssetPath),
  });
  const bookmarks = useQuery({
    queryKey: ["bookmarks", profile.id],
    queryFn: async () => {
      const { data, error } = await client.from("video_bookmarks").select("video_id").eq("student_id", profile.id);
      if (error) throw error;
      return new Set(data.map((bookmark) => bookmark.video_id));
    },
    enabled: !isSensei,
  });
  const visibleVideos = useMemo(() => videos.data ?? [], [videos.data]);
  const visibleStories = useMemo(() => stories.data ?? [], [stories.data]);
  const videoRows = tab === "videos" ? visibleVideos : [];
  const storyRows = tab === "stories" ? visibleStories : [];

  const uploadVideo = useMutation({
    mutationFn: async () => {
      if (!videoFile) throw new Error("Choose a video file first.");
      const extension = videoTypes[videoFile.type];
      if (!extension) throw new Error("Choose an MP4, WebM, or MOV video.");
      if (videoFile.size > 500 * 1024 * 1024) throw new Error("Choose a video smaller than 500 MB.");
      const path = `sensei/${profile.id}/videos/${crypto.randomUUID()}.${extension}`;
      const upload = await client.storage.from("tournament-videos").upload(path, videoFile, {
        contentType: videoFile.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      const { error } = await client.from("tournament_videos").insert({
        sensei_id: profile.id,
        title: videoForm.title.trim(),
        description: videoForm.description.trim(),
        event_name: videoForm.event_name.trim(),
        recorded_on: videoForm.recorded_on || null,
        is_published: videoForm.is_published,
        storage_path: path,
      });
      if (error) {
        const cleanup = await client.storage.from("tournament-videos").remove([path]);
        if (cleanup.error) {
          throw new Error(`${error.message} The uploaded file could not be removed: ${cleanup.error.message}`);
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["videos", profile.id] });
      setShowVideoForm(false);
      setVideoFile(null);
      setVideoForm({ title: "", description: "", event_name: "", recorded_on: "", is_published: false });
      toast.success("Tournament video added");
    },
    onError: (error) => toast.error(error.message || "Could not upload video."),
  });

  const uploadStory = useMutation({
    mutationFn: async () => {
      if (!storyFile) throw new Error("Choose a story image first.");
      const extension = imageTypes[storyFile.type];
      if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
      if (storyFile.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
      if (storyForm.is_published && !storyForm.student_consented) {
        throw new Error("Get consent before publishing a student's grading story or image.");
      }
      const path = `sensei/${profile.id}/stories/${crypto.randomUUID()}.${extension}`;
      const upload = await client.storage.from("belt-stories").upload(path, storyFile, {
        contentType: storyFile.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      const { error } = await client.from("belt_stories").insert({
        sensei_id: profile.id,
        title: storyForm.title.trim(),
        story: storyForm.story.trim(),
        student_display_name: storyForm.student_display_name.trim(),
        belt_from: storyForm.belt_from.trim(),
        belt_to: storyForm.belt_to.trim(),
        promoted_on: storyForm.promoted_on || null,
        student_consented: storyForm.student_consented,
        is_published: storyForm.is_published,
        image_path: path,
      });
      if (error) {
        const cleanup = await client.storage.from("belt-stories").remove([path]);
        if (cleanup.error) {
          throw new Error(`${error.message} The uploaded image could not be removed: ${cleanup.error.message}`);
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["stories", profile.id] });
      setShowStoryForm(false);
      setStoryFile(null);
      setStoryForm({ title: "", story: "", student_display_name: "", belt_from: "", belt_to: "", promoted_on: "", student_consented: false, is_published: false });
      toast.success("Belt story added");
    },
    onError: (error) => toast.error(error.message || "Could not upload belt story."),
  });

  const toggleBookmark = useMutation({
    mutationFn: async (videoId: string) => {
      const saved = bookmarks.data?.has(videoId) ?? false;
      const result = saved
        ? await client.from("video_bookmarks").delete().eq("student_id", profile.id).eq("video_id", videoId)
        : await client.from("video_bookmarks").insert({ student_id: profile.id, video_id: videoId });
      if (result.error) throw result.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks", profile.id] }),
    onError: (error) => toast.error(error.message || "Could not update bookmark."),
  });

  if (videos.isPending || stories.isPending) return <LoadingState label="Loading media library" />;
  if (videos.error || stories.error) return <ErrorState message={(videos.error ?? stories.error)?.message ?? "Could not load media."} />;

  function closePlayer() {
    setSelectedVideo(null);
    setSelectedStory(null);
  }

  return (
    <div className="page-stack">
      <section className="page-heading"><div><span className="eyebrow">{isSensei ? "SENSEI WORKSPACE" : "COMMUNITY MEDIA"}</span><h1>{isSensei ? "Media library" : "Stories & tournaments"}</h1><p>{isSensei ? "Share tournament moments and celebrate student progress." : "A little inspiration from the Kyokushin community."}</p></div>
        {isSensei && <button className="button button-primary" onClick={() => tab === "videos" ? setShowVideoForm(true) : setShowStoryForm(true)} type="button"><Plus size={16} />{tab === "videos" ? "Add video" : "Add story"}</button>}
      </section>
      <div className="tab-row" role="tablist" aria-label="Media type">
        <button aria-selected={tab === "videos"} className={tab === "videos" ? "tab-button selected" : "tab-button"} onClick={() => setTab("videos")} role="tab" type="button"><Film size={16} />Tournament videos<span>{visibleVideos.length}</span></button>
        <button aria-selected={tab === "stories"} className={tab === "stories" ? "tab-button selected" : "tab-button"} onClick={() => setTab("stories")} role="tab" type="button"><Trophy size={16} />Belt stories<span>{visibleStories.length}</span></button>
      </div>
      {videoRows.length === 0 && storyRows.length === 0 ? (
        <EmptyState title={tab === "videos" ? "No tournament videos yet" : "No belt stories yet"} description={isSensei ? "Published community media will appear here after you add it." : "Published dojo media will appear here as Senseis share it."} action={isSensei ? <button className="button button-primary button-small" onClick={() => tab === "videos" ? setShowVideoForm(true) : setShowStoryForm(true)} type="button">Add {tab === "videos" ? "a video" : "a story"}</button> : undefined} />
      ) : (
        <div className={tab === "videos" ? "media-grid" : "story-grid"}>
          {videoRows.map((video) => (
            <article className="media-card" key={video.id}>
              <div className="media-thumbnail"><span className="media-play"><Play size={20} fill="currentColor" /></span><span className="media-type-label">TOURNAMENT</span></div>
              <div className="media-card-body"><span className="eyebrow">{video.event_name || "KYOKUSHIN"}</span><h2>{video.title}</h2><p>{video.description || "Tournament moment shared by the dojo community."}</p><div className="media-card-footer"><span>{video.recorded_on || "Date not listed"}</span><div><button className="button button-secondary button-small" onClick={() => { setSelectedVideo(video); setSelectedStory(null); }} type="button"><Play size={14} />Watch</button>{!isSensei && <button aria-label={`${bookmarks.data?.has(video.id) ? "Remove" : "Save"} ${video.title} bookmark`} className={`icon-button ${bookmarks.data?.has(video.id) ? "bookmarked" : ""}`} disabled={toggleBookmark.isPending} onClick={() => toggleBookmark.mutate(video.id)} type="button"><Bookmark size={17} fill={bookmarks.data?.has(video.id) ? "currentColor" : "none"} /></button>}</div></div></div>
            </article>
          ))}
          {storyRows.map((story) => (
            <article className="story-card" key={story.id}>
              <div className="story-image"><span className="story-belt">{story.belt_to || "KYOKUSHIN"}</span></div>
              <div className="media-card-body"><span className="eyebrow">BELT GRADING · {story.promoted_on || "DATE NOT LISTED"}</span><h2>{story.title}</h2><p>{story.story || `${story.student_display_name || "A student"} celebrates a step forward in their training.`}</p><div className="media-card-footer"><span>{story.student_display_name || "Student story"}{story.belt_from && story.belt_to ? ` · ${story.belt_from} → ${story.belt_to}` : ""}</span><button className="text-link" onClick={() => { setSelectedStory(story); setSelectedVideo(null); }} type="button">Read story</button></div></div>
            </article>
          ))}
        </div>
      )}

      {showVideoForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowVideoForm(false); }}><form className="modal-card" onSubmit={(event: FormEvent) => { event.preventDefault(); uploadVideo.mutate(); }}><div className="modal-heading"><div><span className="eyebrow">MEDIA UPLOAD</span><h2>Add tournament video</h2></div><button aria-label="Close" className="icon-button" onClick={() => setShowVideoForm(false)} type="button"><X size={18} /></button></div><label className="upload-drop"><Upload size={22} /><strong>{videoFile?.name || "Choose a video file"}</strong><small>MP4, WebM, MOV · up to 500 MB</small><input accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => setVideoFile(event.currentTarget.files?.[0] ?? null)} required type="file" /></label><label className="field"><span>Video title</span><input maxLength={160} onChange={(event) => setVideoForm({ ...videoForm, title: event.currentTarget.value })} required value={videoForm.title} /></label><div className="form-row"><label className="field"><span>Event</span><input maxLength={120} onChange={(event) => setVideoForm({ ...videoForm, event_name: event.currentTarget.value })} value={videoForm.event_name} /></label><label className="field"><span>Recorded on</span><input onChange={(event) => setVideoForm({ ...videoForm, recorded_on: event.currentTarget.value })} type="date" value={videoForm.recorded_on} /></label></div><label className="field"><span>Description</span><textarea maxLength={2000} onChange={(event) => setVideoForm({ ...videoForm, description: event.currentTarget.value })} rows={3} value={videoForm.description} /></label><label className="switch-row"><input checked={videoForm.is_published} onChange={(event) => setVideoForm({ ...videoForm, is_published: event.currentTarget.checked })} type="checkbox" /><span><strong>Publish video</strong><small>Published videos can be watched by signed-in students.</small></span></label><button className="button button-primary modal-submit" disabled={uploadVideo.isPending} type="submit">{uploadVideo.isPending ? "Uploading and saving…" : "Save video"} <Upload size={15} /></button>{uploadVideo.error && <p className="inline-error">{uploadVideo.error.message}</p>}</form></div>}

      {showStoryForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowStoryForm(false); }}><form className="modal-card" onSubmit={(event: FormEvent) => { event.preventDefault(); uploadStory.mutate(); }}><div className="modal-heading"><div><span className="eyebrow">BELT GRADING</span><h2>Share a student story</h2></div><button aria-label="Close" className="icon-button" onClick={() => setShowStoryForm(false)} type="button"><X size={18} /></button></div><label className="upload-drop"><ImagePlus size={22} /><strong>{storyFile?.name || "Choose a grading photo"}</strong><small>JPEG, PNG, WebP · up to 20 MB</small><input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setStoryFile(event.currentTarget.files?.[0] ?? null)} required type="file" /></label><label className="field"><span>Story title</span><input maxLength={160} onChange={(event) => setStoryForm({ ...storyForm, title: event.currentTarget.value })} required value={storyForm.title} /></label><label className="field"><span>Student display name (optional)</span><input maxLength={100} onChange={(event) => setStoryForm({ ...storyForm, student_display_name: event.currentTarget.value })} value={storyForm.student_display_name} /></label><div className="form-row"><label className="field"><span>Previous belt</span><input maxLength={80} onChange={(event) => setStoryForm({ ...storyForm, belt_from: event.currentTarget.value })} value={storyForm.belt_from} /></label><label className="field"><span>New belt</span><input maxLength={80} onChange={(event) => setStoryForm({ ...storyForm, belt_to: event.currentTarget.value })} value={storyForm.belt_to} /></label></div>      <div className="form-row"><label className="field"><span>Promotion date</span><input onChange={(event) => setStoryForm({ ...storyForm, promoted_on: event.currentTarget.value })} type="date" value={storyForm.promoted_on} /></label><label className="field"><span>Story</span><textarea maxLength={2000} onChange={(event) => setStoryForm({ ...storyForm, story: event.currentTarget.value })} rows={2} value={storyForm.story} /></label></div><label className="switch-row"><input checked={storyForm.student_consented} onChange={(event) => setStoryForm({ ...storyForm, student_consented: event.currentTarget.checked })} type="checkbox" /><span><strong>Student has consented to public sharing</strong><small>Required before publishing a student's story or grading photo.</small></span></label><label className="switch-row"><input checked={storyForm.is_published} onChange={(event) => setStoryForm({ ...storyForm, is_published: event.currentTarget.checked })} type="checkbox" /><span><strong>Publish story</strong><small>Published stories are visible to signed-in students.</small></span></label><button className="button button-primary modal-submit" disabled={uploadStory.isPending} type="submit">{uploadStory.isPending ? "Uploading and saving…" : "Save story"} <Upload size={15} /></button>{uploadStory.error && <p className="inline-error">{uploadStory.error.message}</p>}</form></div>}

      {(selectedVideo || selectedStory) && <div className="modal-backdrop media-viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePlayer(); }}><section className="modal-card media-viewer"><div className="modal-heading"><div><span className="eyebrow">{selectedVideo ? "TOURNAMENT VIDEO" : "BELT STORY"}</span><h2>{selectedVideo?.title ?? selectedStory?.title}</h2></div><button aria-label="Close media viewer" className="icon-button" onClick={closePlayer} type="button"><X size={18} /></button></div>{selectedAsset.isPending && <LoadingState label="Preparing secure media" />}{selectedAsset.error && <ErrorState message={selectedAsset.error.message} />}{selectedAsset.data && selectedVideo && <video controls preload="metadata" src={selectedAsset.data} />}{selectedAsset.data && selectedStory && <img alt={selectedStory.title} src={selectedAsset.data} />}{selectedStory && <p className="viewer-story-text">{selectedStory.story}</p>}</section></div>}
    </div>
  );
}
