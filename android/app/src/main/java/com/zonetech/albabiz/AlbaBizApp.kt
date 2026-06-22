package com.zonetech.albabiz

import android.app.Application
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Application singleton. Holds a tiny remote-config fetcher so the app can be
 * repointed (or shown a maintenance message) via the Worker's GET /api/config
 * without shipping a Play update. Uses HttpURLConnection on a background thread
 * — no extra HTTP dependency for a single small GET.
 */
class AlbaBizApp : Application() {

    data class RemoteConfig(
        val maintenance: Boolean,
        val message: String?,
        val uiBaseOverride: String?,
        val minVersionCode: Int,
    )

    private val io = Executors.newSingleThreadExecutor()

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    /**
     * Fetch /api/config off the main thread. Always invokes [cb] (with null on
     * any failure) so the caller can fall back to the baked-in UI_BASE.
     */
    fun fetchConfig(cb: (RemoteConfig?) -> Unit) {
        io.execute {
            var result: RemoteConfig? = null
            try {
                val conn = (URL(BuildConfig.API_BASE.trimEnd('/') + "/api/config").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 4000
                    readTimeout = 4000
                }
                if (conn.responseCode in 200..299) {
                    val txt = conn.inputStream.bufferedReader().use { it.readText() }
                    val o = JSONObject(txt)
                    result = RemoteConfig(
                        maintenance = o.optBoolean("maintenance", false),
                        message = if (o.isNull("message")) null else o.optString("message", "").ifBlank { null },
                        uiBaseOverride = if (o.isNull("ui_base_override")) null
                            else o.optString("ui_base_override", "").takeIf { it.isNotBlank() },
                        minVersionCode = o.optInt("min_version_code", 1),
                    )
                }
                conn.disconnect()
            } catch (_: Exception) {
                // offline / API down — caller falls back to BuildConfig.UI_BASE
            }
            cb(result)
        }
    }

    companion object {
        lateinit var instance: AlbaBizApp
            private set
    }
}
