export interface KeysetCursor {
  createdAt: string; // ISO string
  id: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString('base64url');
}

export function decodeCursor(cursor: string): KeysetCursor {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as KeysetCursor;
}

export interface KeysetWhere {
  createdAt: { lt: Date };
  OR?: [{ createdAt: { equals: Date }; id: { lt: string } }];
}

// Builds a WHERE clause for (createdAt DESC, id DESC) keyset pagination.
// Returns prisma-compatible filter for records before the cursor.
export function buildKeysetWhere(cursor: string): object {
  const { createdAt, id } = decodeCursor(cursor);
  const dt = new Date(createdAt);
  return {
    OR: [
      { createdAt: { lt: dt } },
      { createdAt: { equals: dt }, id: { lt: id } },
    ],
  };
}

export function parsePaginationQuery(query: {
  limit?: string;
  cursor?: string;
}): { take: number; cursorWhere: object | null } {
  const take = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 100);
  const cursorWhere = query.cursor ? buildKeysetWhere(query.cursor) : null;
  return { take, cursorWhere };
}

export function buildPageResponse<T extends { createdAt: Date; id: string }>(
  items: T[],
  take: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
  return { items: page, nextCursor };
}
