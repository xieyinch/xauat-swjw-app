package com.xauat.swjw.coursewidget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object WidgetData {
  private const val PREFS = "course_widget"
  private const val KEY = "payload"

  data class Payload(val header: String, val courses: List<String>)

  fun save(context: Context, payload: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY, payload)
      .apply()
  }

  fun load(context: Context): String {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY, "")
      ?: ""
  }

  fun parse(json: String): Payload {
    if (json.isEmpty()) {
      return Payload("本周课表", List(7) { "暂无数据，请打开App刷新" })
    }
    return try {
      val obj = JSONObject(json)
      val header = obj.optString("header", "本周课表")
      val rows = obj.optJSONArray("rows") ?: JSONArray()
      val courses = (0 until 7).map { rows.optString(it, "") }
      Payload(header, courses)
    } catch (e: Exception) {
      Payload("本周课表", List(7) { "暂无数据，请打开App刷新" })
    }
  }
}
