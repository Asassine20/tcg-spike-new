"use client";

import * as React from "react";

interface SubTypeSelectProps {
  options: (string | null)[];
  value: string;
  productId: number;
}

export default function SubTypeSelect({
  options,
  value,
  productId,
}: SubTypeSelectProps) {
  return (
    <select
      className="rounded border px-2 py-1 text-sm"
      value={value}
      onChange={(e) => {
        const selected = e.target.value;
        const encoded = encodeURIComponent(selected);
        const subTypeNameQuery = selected
          ? `?subTypeName=${encodeURIComponent(selected.trim())}`
          : "";
        const productDetailsUrl = `/product/${productId}${subTypeNameQuery}`;
        window.location.href = productDetailsUrl;
      }}
    >
      {options.map((option) => {
        if (!option) return null; // Skip null options
        const isHolo = option.toLowerCase().includes("holo");
        return (
          <option key={option} value={option}>
            {option}
          </option>
        );
      })}
    </select>
  );
}
