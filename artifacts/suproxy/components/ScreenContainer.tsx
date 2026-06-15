import React from "react";
import { View, type ViewProps, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface ScreenContainerProps extends ViewProps {
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();

  return (
    <View style={[styles.outer, { backgroundColor: colors.background }]} {...props}>
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <View style={[styles.inner, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
});
