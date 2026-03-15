import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../utils/constants';
import { BrutalButton } from './BrutalButton';
import { EntityCover } from './EntityCover';

type ImagePickerFieldProps = {
  label: string;
  imageUri: string | null;
  fallbackIcon: string;
  onPick: () => void;
  onRemove: () => void;
  helperText?: string;
};

const DEFAULT_HELPER_TEXT =
  '上传后会优先显示图片封面；不上传时继续显示当前图标。你也可以随时重新更换或恢复默认图标。';

export function ImagePickerField({
  label,
  imageUri,
  fallbackIcon,
  onPick,
  onRemove,
  helperText = DEFAULT_HELPER_TEXT,
}: ImagePickerFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <EntityCover
          imageUri={imageUri}
          icon={fallbackIcon}
          size={88}
          iconSize={34}
          backgroundColor={THEME.colors.background}
        />
        <View style={styles.info}>
          <Text style={styles.helper}>{helperText}</Text>
          <View style={styles.actions}>
            <BrutalButton
              title={imageUri ? '更换图片' : '上传图片'}
              onPress={onPick}
              variant="accent"
              size="sm"
              style={styles.actionBtn}
            />
            {imageUri ? (
              <BrutalButton
                title="恢复默认"
                onPress={onRemove}
                variant="outline"
                size="sm"
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        </View>
      </View>
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
  row: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  helper: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
