import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  stampWrapper: {
    position: "absolute",
    top: 160,
    left: 30,
    right: 30,
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "none",
  },
  stamp: {
    transform: "rotate(-30deg)",
    borderWidth: 4,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    opacity: 0.2,
  },
  stampText: {
    fontSize: 36,
    fontWeight: "bold",
    letterSpacing: 6,
  },
  paid: {
    borderColor: "#16a34a",
  },
  paidText: {
    color: "#16a34a",
  },
  cancelled: {
    borderColor: "#dc2626",
  },
  cancelledText: {
    color: "#dc2626",
  },
});

export function InvoiceStamp({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <View style={styles.stampWrapper}>
        <View style={[styles.stamp, styles.paid]}>
          <Text style={[styles.stampText, styles.paidText]}>PAYÉ</Text>
        </View>
      </View>
    );
  }
  if (status === "cancelled") {
    return (
      <View style={styles.stampWrapper}>
        <View style={[styles.stamp, styles.cancelled]}>
          <Text style={[styles.stampText, styles.cancelledText]}>ANNULÉ</Text>
        </View>
      </View>
    );
  }
  return null;
}
