package com.xauat.swjw.coursewidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.view.View
import android.widget.RemoteViews

class CourseWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    updateAll(context, appWidgetManager, appWidgetIds)
  }

  companion object {
    private const val OPEN_URI = "xauatswjw://course-table"

    private val LEFT_HEAD = intArrayOf(R.id.col_l_c1, R.id.col_l_c2, R.id.col_l_c3)
    private val LEFT_SUB = intArrayOf(R.id.col_l_s1, R.id.col_l_s2, R.id.col_l_s3)
    private val LEFT_ROWS = intArrayOf(R.id.col_l_row_1, R.id.col_l_row_2, R.id.col_l_row_3)
    private val RIGHT_HEAD = intArrayOf(R.id.col_r_c1, R.id.col_r_c2, R.id.col_r_c3)
    private val RIGHT_SUB = intArrayOf(R.id.col_r_s1, R.id.col_r_s2, R.id.col_r_s3)
    private val RIGHT_ROWS = intArrayOf(R.id.col_r_row_1, R.id.col_r_row_2, R.id.col_r_row_3)

    fun updateAll(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val payload = WidgetData.parse(WidgetData.load(context))
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.course_widget)
        views.setTextViewText(R.id.widget_header, payload.header)
        views.setTextViewText(R.id.widget_sub, payload.sub)
        views.setTextViewText(R.id.col_l_title, payload.leftTitle)
        views.setTextViewText(R.id.col_r_title, payload.rightTitle)
        bindColumn(views, payload.left, R.id.col_l_empty, LEFT_HEAD, LEFT_SUB, LEFT_ROWS)
        bindColumn(views, payload.right, R.id.col_r_empty, RIGHT_HEAD, RIGHT_SUB, RIGHT_ROWS)
        val monet = monetBackgroundColor(context)
        if (monet != 0) views.setInt(R.id.widget_root, "setColorFilter", monet)
        views.setOnClickPendingIntent(R.id.widget_root, openAppIntent(context))
        manager.updateAppWidget(id, views)
      }
    }

    private fun bindColumn(
      views: RemoteViews,
      slots: List<WidgetData.Slot>,
      emptyId: Int,
      headIds: IntArray,
      subIds: IntArray,
      rowIds: IntArray
    ) {
      val hasData = slots.isNotEmpty()
      views.setViewVisibility(emptyId, if (hasData) View.GONE else View.VISIBLE)
      for (i in 0 until headIds.size) {
        val rowVisible = hasData && i < slots.size
        views.setViewVisibility(rowIds[i], if (rowVisible) View.VISIBLE else View.GONE)
        views.setTextViewText(headIds[i], if (i < slots.size) slots[i].head else "")
        views.setTextViewText(subIds[i], if (i < slots.size) slots[i].sub else "")
      }
    }

    private fun openAppIntent(context: Context): PendingIntent {
      val intent = Intent().apply {
        component = ComponentName(context.packageName, "${context.packageName}.MainActivity")
        data = Uri.parse(OPEN_URI)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
        addCategory(Intent.CATEGORY_DEFAULT)
      }
      return PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    // ---- Android 12+ Material You 动态取色 ----

    private fun accentColorId(tone: Int): Int? = when (tone) {
      300 -> android.R.color.system_accent1_300
      400 -> android.R.color.system_accent1_400
      500 -> android.R.color.system_accent1_500
      600 -> android.R.color.system_accent1_600
      700 -> android.R.color.system_accent1_700
      800 -> android.R.color.system_accent1_800
      900 -> android.R.color.system_accent1_900
      else -> null
    }

    private fun channelLinear(c: Int): Double {
      val v = c / 255.0
      return if (v <= 0.04045) v / 12.92 else Math.pow((v + 0.055) / 1.055, 2.4)
    }

    private fun relativeLuminance(color: Int): Double {
      return 0.2126 * channelLinear(Color.red(color)) +
        0.7152 * channelLinear(Color.green(color)) +
        0.0722 * channelLinear(Color.blue(color))
    }

    /** 读取动态强调色色板，挑选足够深（保证白字可读）的色调作为背景；低版本返回 0 表示不覆盖 */
    private fun monetBackgroundColor(context: Context): Int {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return 0
      val order = intArrayOf(500, 600, 700, 400, 800, 300, 900)
      var darkest = 0
      var darkestLum = 1.1
      for (tone in order) {
        val id = accentColorId(tone) ?: continue
        val color = try {
          context.getColor(id)
        } catch (e: Exception) {
          continue
        }
        val lum = relativeLuminance(color)
        if (lum < darkestLum) {
          darkestLum = lum
          darkest = color
        }
        if (lum <= 0.18) return color
      }
      return darkest
    }
  }
}
