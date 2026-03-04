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

  const dateValue = value ? new Date(value) : new Date();

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
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
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
});
