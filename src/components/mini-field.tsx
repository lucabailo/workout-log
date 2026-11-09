import { StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Small labelled number box used in rows of targets (sets, reps, kg, rest). */
export function Mini({
  label,
  value,
  onChange,
  keyboard,
  placeholder,
  editable = true,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard: 'number-pad' | 'decimal-pad' | 'numbers-and-punctuation' | 'default';
  placeholder?: string;
  editable?: boolean;
  hideLabel?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      {!hideLabel && (
        <Txt variant="small" tone="muted">
          {label}
        </Txt>
      )}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        selectTextOnFocus
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
        editable={editable}
        style={[styles.mini, { backgroundColor: t.surfaceAlt, color: editable ? t.text : t.textMuted }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mini: {
    minWidth: 0,
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
