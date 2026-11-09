import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Radius, Spacing } from '@/constants/theme';
import { formatDateInput } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'default' | 'muted' | 'accent' | 'success' | 'danger' | 'record';

export function Txt({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: 'title' | 'heading' | 'body' | 'small' | 'label' | 'number'; tone?: Tone }) {
  const t = useTheme();
  const color = {
    default: t.text,
    muted: t.textMuted,
    accent: t.accent,
    success: t.success,
    danger: t.danger,
    record: t.record,
  }[tone];
  return <Text style={[styles[variant], { color }, style]} {...rest} />;
}

/** Scrollable page with the app background and comfortable padding. */
/**
 * Scrollable screen body. When the keyboard opens it scrolls the focused field into view
 * (Android draws edge-to-edge, so the system no longer resizes the screen for the keyboard).
 */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={[{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 120 }, style]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      bottomOffset={Spacing.xl}>
      {children}
    </KeyboardAwareScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.surface, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth },
        styles.card,
        style,
      ]}>
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  style,
  disabled,
  ...rest
}: PressableProps & { title: string; variant?: ButtonVariant; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const look = {
    primary: { bg: t.accent, fg: t.accentText, border: t.accent },
    secondary: { bg: t.surfaceAlt, fg: t.text, border: t.surfaceAlt },
    danger: { bg: 'transparent', fg: t.danger, border: t.danger },
    ghost: { bg: 'transparent', fg: t.accent, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}>
      <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSm, { color: look.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'record' }: { label: string; tone?: 'record' | 'success' }) {
  const t = useTheme();
  const colors = tone === 'record' ? { bg: t.recordSoft, fg: t.record } : { bg: t.successSoft, fg: t.success };
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.stat}>
      <Txt variant="number">{value}</Txt>
      <Txt variant="small" tone="muted">
        {label}
      </Txt>
    </Card>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Txt variant="heading">{title}</Txt>
      <Txt tone="muted" style={{ textAlign: 'center' }}>
        {message}
      </Txt>
      {action}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: t.background }]}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

/** Labelled input with an optional unit on the right ("kg", "%"). */
export function Field({
  label,
  unit,
  style,
  ...input
}: TextInputProps & { label: string; unit?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ gap: 6, flex: 1 }, style]}>
      <Txt variant="small" style={{ fontWeight: '600' }}>
        {label}
      </Txt>
      <View style={[styles.field, { backgroundColor: t.surfaceAlt }]}>
        <TextInput
          placeholderTextColor={t.textMuted}
          style={[styles.fieldInput, { color: t.text }]}
          accessibilityLabel={unit ? `${label} in ${unit}` : label}
          {...input}
        />
        {unit && (
          <Txt tone="muted" variant="small" style={{ fontWeight: '600' }}>
            {unit}
          </Txt>
        )}
      </View>
    </View>
  );
}

/** A Field for dates: number keyboard, and the slashes of DD/MM/YYYY are typed for you. */
export function DateField({
  onChangeText,
  ...props
}: Omit<TextInputProps, 'keyboardType' | 'maxLength'> & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Field
      placeholder="DD/MM/YYYY"
      {...props}
      keyboardType="number-pad"
      maxLength={10}
      onChangeText={(text) => onChangeText?.(formatDateInput(text))}
    />
  );
}

/** Two to four mutually exclusive options in a pill. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: t.border }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={String(o)}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: t.accent }]}>
            <Text style={{ color: on ? t.accentText : t.text, fontWeight: on ? '700' : '500', fontSize: 14 }}>
              {format(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small uppercase heading above a group of cards. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Txt variant="label" tone="muted">
        {children}
      </Txt>
      {right}
    </View>
  );
}

/** Tappable row inside a card: title, optional detail, value and chevron. */
export function ListRow({
  title,
  detail,
  value,
  onPress,
  tone,
  chevron = !!onPress,
  first = false,
}: {
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  tone?: Tone;
  chevron?: boolean;
  first?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.listRow,
        !first && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt tone={tone} style={{ fontWeight: '600' }}>
          {title}
        </Txt>
        {detail ? (
          <Txt variant="small" tone="muted">
            {detail}
          </Txt>
        ) : null}
      </View>
      {value ? <Txt tone="muted">{value}</Txt> : null}
      {chevron && <Txt tone="muted" style={{ fontSize: 20 }}>›</Txt>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  fieldInput: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: 3,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm },
  sectionLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 13 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  number: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  card: { borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  button: {
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSm: { paddingVertical: 7, paddingHorizontal: Spacing.lg },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSm: { fontSize: 14 },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  stat: { flex: 1, gap: 2, padding: Spacing.md },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
