import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { THEME } from '../utils/constants';
import { formatDate } from '../utils/formatters';

interface DatePickerFieldProps {
  label: string;
  value: string; // 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  style?: ViewStyle;
}

export function DatePickerField({ label, value, onChange, style }: DatePickerFieldProps) {
  const [show, setShow] = useState(false);

  // 注意：new Date('YYYY-MM-DD') 会按 UTC 解析，部分时区会导致日期“偏移一天”。
  // 这里显式按本地日期构造，确保 picker 初始值与展示一致。
  const dateValue = value
    ? (() => {
      const [y, m, d] = value.split('-').map(Number);
      if (!y || !m || !d) return new Date();
      return new Date(y, m - 1, d);
    })()
    : new Date();

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.fieldText}>{value ? formatDate(value) : '请选择日期'}</Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          // Android 默认 calendar 容易让人误以为只能“按月翻”；spinner 对“跨年跳转”更直观。
          display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
          onChange={handleChange}
        />
      )}
      {Platform.OS === 'android' && (
        <Text style={styles.hint}>小技巧：滚动年份/月份可以快速跳转</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: THEME.spacing.md,
  },
  label: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  field: {
    ...THEME.pixelBorder,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldText: {
    fontSize: THEME.fontSize.md,
    color: THEME.colors.textPrimary,
  },
  icon: {
    fontSize: 18,
  },
  hint: {
    marginTop: THEME.spacing.xs,
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
  },
});
