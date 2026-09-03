/**
 * ui/index.ts — Kit d'interface NetOff
 *
 * Tous les écrans importent d'ici : `import { Screen, AppBar, Card } from "@/ui";`
 * Rien dans `app/` ne doit redéfinir un bouton, un interrupteur ou une carte —
 * si un besoin n'est pas couvert, le composant est ajouté ici.
 */

export { AppAvatar, packageColor, packageHue, type AppAvatarProps } from "./AppAvatar";
export { Badge, Chip, Dot, type BadgeProps, type BadgeTone, type ChipProps } from "./Badge";
export { Button, ButtonRow, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Icon, IconSize, type IconName, type IconProps } from "./Icon";
export { IconButton, type IconButtonProps, type IconButtonVariant } from "./IconButton";
export { ListGroup, ListRow, type ListRowProps, type ListRowTone } from "./ListRow";
export { Meter, ProgressBar, ProgressRing, type MeterSegment } from "./Progress";
export {
  AppBar,
  LargeTitle,
  Screen,
  ScreenScroll,
  useScrollY,
  type AppBarAction,
  type AppBarProps,
} from "./Screen";
export { SearchField, TextField, type SearchFieldProps, type TextFieldProps } from "./SearchField";
export { Segmented, Tabs, type SegmentOption, type SegmentedProps } from "./Segmented";
export { Dialog, Sheet, type DialogProps, type SheetProps } from "./Sheet";
export { Skeleton, SkeletonCard, SkeletonList, SkeletonRow } from "./Skeleton";
export { Stat, StatBand, StatTile, type StatProps, type StatTileProps } from "./Stat";
export { Card, Divider, Section, Surface, type CardProps, type Elevation } from "./Surface";
export { Switch, type SwitchProps, type SwitchTone } from "./Switch";
export { Text, type TextProps, type TextTone } from "./Text";
export { ToastHost, toast, type ToastOptions, type ToastTone } from "./Toast";
export { Touchable, type HapticStyle, type PressFeedback, type TouchableProps } from "./Touchable";
