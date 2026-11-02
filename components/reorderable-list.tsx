"use client";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "./ui";

export function ReorderableList<T>({
  items,
  getKey,
  getLabel,
  label,
  onMove,
  disabled = false,
  renderItem,
}: {
  items: readonly T[];
  getKey: (item: T) => string;
  getLabel: (item: T, index: number) => string;
  label: string;
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
  renderItem: (item: T, index: number, controls: ReactNode) => ReactNode;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; after: boolean } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState("");
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const clearDrag = () => {
    setDragged(null);
    setOver(null);
  };
  const move = (from: number, to: number, focus?: HTMLElement) => {
    if (disabled || from === to || from < 0 || to < 0 || to >= items.length)
      return;
    const key = getKey(items[from]);
    const name = getLabel(items[from], from);
    onMove(from, to);
    setAnnouncement(`${name} moved to position ${to + 1} of ${items.length}.`);
    requestAnimationFrame(() => {
      if (!focus || focus.matches(":disabled"))
        handles.current.get(key)?.focus();
      else focus.focus();
    });
  };
  return (
    <>
      <ol aria-label={label} className="space-y-3">
        {items.map((item, index) => {
          const key = getKey(item);
          const name = getLabel(item, index);
          const controls = (
            <div className="flex shrink-0 items-center">
              <Button
                ref={(element) => {
                  if (element) handles.current.set(key, element);
                  else handles.current.delete(key);
                }}
                variant="quiet"
                draggable={!disabled && items.length > 1}
                disabled={disabled || items.length < 2}
                aria-label={`Drag ${name}`}
                title="Drag to reorder"
                className="cursor-grab active:cursor-grabbing"
                onDragStart={(event) => {
                  if (event.currentTarget.matches(":disabled")) {
                    event.preventDefault();
                    return;
                  }
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", "CVRaga item");
                  setDragged(key);
                }}
                onDragEnd={clearDrag}
              >
                <GripVertical size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="quiet"
                disabled={disabled || index === 0}
                aria-label={`Move ${name} up`}
                title="Move up"
                onClick={(event) => move(index, index - 1, event.currentTarget)}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="quiet"
                disabled={disabled || index === items.length - 1}
                aria-label={`Move ${name} down`}
                title="Move down"
                onClick={(event) => move(index, index + 1, event.currentTarget)}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </Button>
            </div>
          );
          return (
            <li
              key={key}
              onDragOver={(event) => {
                if (
                  !dragged ||
                  dragged === key ||
                  disabled ||
                  event.currentTarget.closest("fieldset[disabled]")
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
                const box = event.currentTarget.getBoundingClientRect();
                const after = event.clientY > box.top + box.height / 2;
                setOver((current) =>
                  current?.key === key && current.after === after
                    ? current
                    : { key, after },
                );
              }}
              onDrop={(event) => {
                if (
                  !dragged ||
                  !over ||
                  over.key !== key ||
                  disabled ||
                  event.currentTarget.closest("fieldset[disabled]")
                )
                  return;
                event.preventDefault();
                event.stopPropagation();
                const from = items.findIndex(
                  (entry) => getKey(entry) === dragged,
                );
                const to =
                  index + (over.after ? 1 : 0) - (from < index ? 1 : 0);
                move(from, to, handles.current.get(dragged));
                clearDrag();
              }}
              className={`rounded-control ${dragged === key ? "opacity-50" : ""} ${over?.key === key ? `bg-accent ${over.after ? "shadow-[inset_0_-3px_var(--color-primary)]" : "shadow-[inset_0_3px_var(--color-primary)]"}` : ""}`}
            >
              {renderItem(item, index, controls)}
            </li>
          );
        })}
      </ol>
      <p role="status" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
