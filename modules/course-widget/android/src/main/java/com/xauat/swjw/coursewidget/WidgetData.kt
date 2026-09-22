package com.xauat.swjw.coursewidget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object WidgetData {
  private const val PREFS = "course_widget"
  private const val KEY = "payload"

  data class Slot(val head: String, val sub: String, val endAt: Long = 0L)
  data class Day(val date: String, val week: Int, val slots: List<Slot>)

  data class Payload(
    val header: String,
    val sub: String,
    val leftTitle: String,
    val rightTitle: String,
    val left: List<Slot>,
    val right: List<Slot>,
    val days: List<Day> = emptyList()
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
        right = parseSlots(obj.optJSONArray("right")),
        days = parseDays(obj.optJSONArray("days"))
      )
    } catch (e: Exception) {
      Payload("本周课表", "打开 App 自动同步课程", "今天", "明天", emptyList(), emptyList())
    }
  }

  private fun parseSlots(arr: JSONArray?): List<Slot> {
    if (arr == null) return emptyList()
    return (0 until arr.length()).mapNotNull { i ->
      val o = arr.optJSONObject(i) ?: return@mapNotNull null
      Slot(o.optString("head", ""), o.optString("sub", ""), o.optLong("endAt", 0L))
    }
  }

  private fun parseDays(arr: JSONArray?): List<Day> {
    if (arr == null) return emptyList()
    return (0 until arr.length()).mapNotNull { i ->
      val o = arr.optJSONObject(i) ?: return@mapNotNull null
      Day(o.optString("date", ""), o.optInt("week", 1), parseSlots(o.optJSONArray("slots")))
    }
  }

  fun current(payload: Payload, now: Long = System.currentTimeMillis()): Payload {
    if (payload.days.isEmpty()) return payload
    val calendar = Calendar.getInstance().apply { timeInMillis = now }
    val format = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT)
    val today = format.format(calendar.time)
    val left = payload.days.find { it.date == today }
      ?: return Payload("今日课表", "打开 App 更新课程", "今天", "明天", emptyList(), emptyList())
    val monthDay = "${calendar.get(Calendar.MONTH) + 1}月${calendar.get(Calendar.DAY_OF_MONTH)}日"
    val weekDay = dayName(calendar.get(Calendar.DAY_OF_WEEK))
    calendar.add(Calendar.DAY_OF_YEAR, 1)
    val right = payload.days.find { it.date == format.format(calendar.time) }
    val upcoming = left.slots.filter { it.endAt <= 0L || it.endAt > now }
    val tomorrow = right?.slots ?: emptyList()
    return payload.copy(
      header = "$monthDay · $weekDay",
      sub = "第${left.week}周 · 今 ${if (upcoming.isEmpty()) "无课" else "${upcoming.size} 门"} · 明 ${if (tomorrow.isEmpty()) "无课" else "${tomorrow.size} 门"}",
      leftTitle = "今天 · $weekDay",
      rightTitle = "明天 · ${dayName(calendar.get(Calendar.DAY_OF_WEEK))}",
      left = upcoming.take(3),
      right = tomorrow.take(3)
    )
  }

  fun nextChange(payload: Payload, now: Long = System.currentTimeMillis()): Long? {
    if (payload.days.isEmpty()) return null
    val calendar = Calendar.getInstance().apply { timeInMillis = now }
    val today = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(calendar.time)
    val end = payload.days.find { it.date == today }?.slots
      ?.map { it.endAt }?.filter { it > now }?.minOrNull()
    calendar.add(Calendar.DAY_OF_YEAR, 1)
    calendar.set(Calendar.HOUR_OF_DAY, 0)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 1)
    calendar.set(Calendar.MILLISECOND, 0)
    return listOfNotNull(end, calendar.timeInMillis.takeIf { it > now }).minOrNull()
  }

  private fun dayName(day: Int): String = when (day) {
    Calendar.MONDAY -> "周一"
    Calendar.TUESDAY -> "周二"
    Calendar.WEDNESDAY -> "周三"
    Calendar.THURSDAY -> "周四"
    Calendar.FRIDAY -> "周五"
    Calendar.SATURDAY -> "周六"
    else -> "周日"
  }
}
