/**
 * Runtime feature flag for the desktop update channel.
 *
 * Keep this shared by Main and Renderer so a stale persisted preference or
 * an old update event cannot re-enable update checks or notifications.
 */
export const APP_UPDATES_ENABLED = false;
