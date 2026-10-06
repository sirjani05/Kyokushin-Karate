fn validate_auth_storage_key(key: &str) -> Result<(), String> {
    if key.len() > 128 || !key.starts_with("sb-") || !key.ends_with("-auth-token") {
        return Err("Unsupported secure-storage key".to_string());
    }
    Ok(())
}

#[tauri::command]
fn secure_store_get(key: String) -> Result<Option<String>, String> {
    validate_auth_storage_key(&key)?;
    let entry = keyring::Entry::new("com.sirjani.kyokushin-karate", &key)
        .map_err(|error| format!("Could not access the operating-system credential store: {error}"))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read the saved sign-in session: {error}")),
    }
}

#[tauri::command]
fn secure_store_set(key: String, value: String) -> Result<(), String> {
    validate_auth_storage_key(&key)?;
    let entry = keyring::Entry::new("com.sirjani.kyokushin-karate", &key)
        .map_err(|error| format!("Could not access the operating-system credential store: {error}"))?;
    entry
        .set_password(&value)
        .map_err(|error| format!("Could not save the sign-in session securely: {error}"))
}

#[tauri::command]
fn secure_store_delete(key: String) -> Result<(), String> {
    validate_auth_storage_key(&key)?;
    let entry = keyring::Entry::new("com.sirjani.kyokushin-karate", &key)
        .map_err(|error| format!("Could not access the operating-system credential store: {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove the saved sign-in session: {error}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            secure_store_get,
            secure_store_set,
            secure_store_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
