package com.xauat.swjw.coursewidget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object WidgetData {
  private const val PREFS = "course_widget"
  private const val KEY = "payload"

  data class Slot(val head: String, val sub: String)

  data class Payload(
    val header: String,
    val sub: String,
    val leftTitle: String,
    val rightTitle: String,
    val left: List<Slot>,
    val right: List<Slot>
  )

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
      return Payload("本周课表", "打开 App 自动同步课程", "今天", "明天", emptyList(), emptyList())
    }
    return try {
      val obj = JSONObject(json)
      Payload(
        header = obj.optString("header", "本周课表"),
        sub = obj.optString("sub", ""),
        leftTitle = obj.optString("leftTitle", "今天"),
        rightTitle = obj.optString("rightTitle", "明天"),
        left = parseSlots(obj.optJSONArray("left")),
        right = parseSlots(obj.optJSONArray("right"))
      )
    } catch (e: Exception) {
      Payload("本周课表", "打开 App 自动同步课程", "今天", "明天", emptyList(), emptyList())
    }
  }

  private fun parseSlots(arr: JSONArray?): List<Slot> {
    if (arr == null) return emptyList()
    return (0 until arr.length()).mapNotNull { i ->
      val o = arr.optJSONObject(i) ?: return@mapNotNull null
      Slot(o.optString("head", ""), o.optString("sub", ""))
    }
  }
}
