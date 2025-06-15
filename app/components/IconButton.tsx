import React from 'react';
import { GestureResponderEvent, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

type IconButtonProps = {
  iconName: React.ComponentProps<typeof FontAwesome6>['name'];
  iconSize?: number;
  iconColor?: string;
  onPress: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function IconButton({
  iconName,
  iconSize = 24,
  iconColor = 'black',
  onPress,
  style = {},
  accessibilityLabel,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[{ padding: 8 }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <FontAwesome6 name={iconName} size={iconSize} color={iconColor}/>
    </TouchableOpacity>
  );
}
