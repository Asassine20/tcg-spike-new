"use client";

import React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type GroupedOption = {
  label: string;
  value: string;
  options: {
    label: string;
    value: string;
  }[];
};

interface MultiSelectGroupedProps {
  options: GroupedOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectGroupedBadges({
  selectedValues,
  maxCount = 2,
}: {
  selectedValues: string[];
  maxCount?: number;
}) {
  if (selectedValues.length > maxCount) {
    return (
      <Badge variant="secondary" className="mr-1 rounded-sm px-1 font-normal">
        Filtering by {selectedValues.length} sets
      </Badge>
    );
  }

  return (
    <>
      {selectedValues.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className="mr-1 rounded-sm px-1 font-normal"
        >
          {value}
        </Badge>
      ))}
    </>
  );
}

export const MultiSelectGrouped = React.forwardRef<
  HTMLButtonElement,
  MultiSelectGroupedProps
>(({ options, value, onChange, placeholder, className }, ref) => {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedValue: string) => {
    const newSelectedValues = value.includes(selectedValue)
      ? value.filter((v) => v !== selectedValue)
      : [...value, selectedValue];
    onChange(newSelectedValues);
  };

  const handleGroupSelect = (group: GroupedOption) => {
    const groupValues = group.options.map((opt) => opt.value);
    const allSelected = groupValues.every((v) => value.includes(v));

    let newSelectedValues: string[];
    if (allSelected) {
      // Deselect all in this group
      newSelectedValues = value.filter((v) => !groupValues.includes(v));
    } else {
      // Select all in this group (and keep others)
      // Option A: concat + filter to remove duplicates
      const combined = value.concat(groupValues);
      newSelectedValues = combined.filter(function (item, index) {
        return combined.indexOf(item) === index;
      });
    }
    onChange(newSelectedValues);
  };

  const getSelectedLabels = () => {
    const selectedLabels: string[] = [];
    options.forEach((group) => {
      group.options.forEach((option) => {
        if (value.includes(option.value)) {
          selectedLabels.push(option.label);
        }
      });
    });
    return selectedLabels;
  };

  const selectedLabels = getSelectedLabels();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          onClick={() => setOpen(!open)}
        >
          <div className="flex items-center gap-1 overflow-hidden">
            {selectedLabels.length > 0 ? (
              <>
                <MultiSelectGroupedBadges selectedValues={selectedLabels} />
                {/* <Badge
                  variant="secondary"
                  className="mr-1 rounded-sm px-1 font-normal"
                >
                  {selectedLabels.length}
                </Badge> */}
                {/* <span className="truncate">
                  {selectedLabels.length === 1
                    ? selectedLabels[0]
                    : selectedLabels.join(', ')}
                </span> */}
              </>
            ) : (
              (placeholder ?? "Select...")
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {options.map((group) => {
              const groupValues = group.options.map((opt) => opt.value);
              const allSelected = groupValues.every((v) => value.includes(v));
              const someSelected =
                !allSelected && groupValues.some((v) => value.includes(v));

              return (
                <CommandGroup key={group.value} heading={group.label}>
                  <CommandItem
                    onSelect={() => handleGroupSelect(group)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        allSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                        someSelected ? "bg-primary/50" : "",
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{group.label}</span>
                  </CommandItem>
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="pl-8"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          value.includes(option.value)
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible",
                        )}
                      >
                        <Check className={cn("h-4 w-4")} />
                      </div>
                      <span>{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
          {value.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => onChange([])}
                  className="justify-center text-center"
                >
                  Clear filters
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
});

MultiSelectGrouped.displayName = "MultiSelectGrouped";
