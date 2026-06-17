import {
  plainLine,
  serializeStyledLine,
  styledLineWidth,
  type StyledLine,
} from "./styled-text";

export interface FrameModel {
  lines: StyledLine[];
  topRow: number;
  scrollTop: number;
  scrollBottom: number;
  cursor: {
    row: number;
    col: number;
    visible: boolean;
  };
}

export type DiffOp =
  | { kind: "set_scroll_region"; top: number; bottom: number }
  | { kind: "set_cursor_visibility"; visible: boolean }
  | { kind: "scroll_up"; top: number; bottom: number; lines: number }
  | { kind: "write_line"; row: number; line: StyledLine }
  | { kind: "set_cursor"; row: number; col: number };

function lineKey(line: StyledLine | undefined): string {
  return line ? serializeStyledLine(line) : "";
}

function canScrollUpOne(previous: FrameModel, next: FrameModel): boolean {
  if (
    previous.topRow !== next.topRow ||
    previous.scrollTop !== next.scrollTop ||
    previous.scrollBottom !== next.scrollBottom
  ) {
    return false;
  }

  const start = next.scrollTop - next.topRow;
  const end = next.scrollBottom - next.topRow;

  if (start < 0 || end < start || end + 1 >= next.lines.length) {
    return false;
  }

  for (let index = start; index < end; index += 1) {
    if (lineKey(next.lines[index]) !== lineKey(previous.lines[index + 1])) {
      return false;
    }
  }

  return true;
}

export function diffFrames(previous: FrameModel | null, next: FrameModel): DiffOp[] {
  const operations: DiffOp[] = [];

  if (
    !previous ||
    previous.scrollTop !== next.scrollTop ||
    previous.scrollBottom !== next.scrollBottom
  ) {
    operations.push({
      kind: "set_scroll_region",
      top: next.scrollTop,
      bottom: next.scrollBottom,
    });
  }

  if (!previous || previous.cursor.visible !== next.cursor.visible) {
    operations.push({ kind: "set_cursor_visibility", visible: next.cursor.visible });
  }

  const handledRows = new Set<number>();

  if (previous && canScrollUpOne(previous, next)) {
    operations.push({
      kind: "scroll_up",
      top: next.scrollTop,
      bottom: next.scrollBottom,
      lines: 1,
    });

    const start = next.scrollTop - next.topRow;
    const end = next.scrollBottom - next.topRow;

    for (let index = start; index < end; index += 1) {
      handledRows.add(index);
    }
  }

  for (let index = 0; index < next.lines.length; index += 1) {
    if (handledRows.has(index)) {
      continue;
    }

    const nextLine = next.lines[index] ?? plainLine("");
    const previousLine = previous?.lines[index];
    const nextLineIsEmpty = lineKey(nextLine) === "";

    // Preserve existing terminal content outside active rows on the first paint.
    if (!previous && nextLineIsEmpty) {
      continue;
    }

    if (!previousLine || lineKey(previousLine) !== lineKey(nextLine)) {
      operations.push({
        kind: "write_line",
        row: next.topRow + index,
        line: nextLine,
      });
    }
  }

  operations.push({
    kind: "set_cursor",
    row: next.cursor.row,
    col: next.cursor.col,
  });

  return operations;
}

export function serializeDiffOps(operations: DiffOp[]): string {
  const chunks: string[] = [];

  for (const operation of operations) {
    if (operation.kind === "set_scroll_region") {
      chunks.push(`\x1b[${operation.top};${operation.bottom}r`);
      continue;
    }

    if (operation.kind === "set_cursor_visibility") {
      chunks.push(operation.visible ? "\x1b[?25h" : "\x1b[?25l");
      continue;
    }

    if (operation.kind === "scroll_up") {
      chunks.push(`\x1b[${operation.bottom};1H`);
      for (let index = 0; index < operation.lines; index += 1) {
        chunks.push("\n");
      }
      continue;
    }

    if (operation.kind === "write_line") {
      chunks.push(`\x1b[${operation.row};1H\x1b[K${serializeStyledLine(operation.line)}`);
      continue;
    }

    if (operation.kind === "set_cursor") {
      chunks.push(`\x1b[${operation.row};${operation.col}H`);
    }
  }

  return chunks.join("");
}

export function clampFrameCursor(frame: FrameModel, rows: number, columns: number): FrameModel {
  const maxRow = Math.max(1, rows);
  const maxCol = Math.max(1, columns);
  const row = Math.min(maxRow, Math.max(1, frame.cursor.row));
  const col = Math.min(maxCol, Math.max(1, frame.cursor.col));

  return {
    ...frame,
    cursor: {
      ...frame.cursor,
      row,
      col,
    },
  };
}

export function cursorColFromLine(line: StyledLine, columns: number): number {
  const maxCol = Math.max(1, columns);
  return Math.min(maxCol, Math.max(1, styledLineWidth(line) + 1));
}
