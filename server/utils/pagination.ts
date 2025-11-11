import { z } from 'zod';
import { SQL, sql, desc, asc, gt, lt, and } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

export interface PaginationParams {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    totalReturned: number;
  };
}

export interface CursorData {
  id: string;
  timestamp?: number;
  sortField?: string; // For sorting by non-timestamp fields (e.g., legalName)
}

export const paginationParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  direction: z.enum(['forward', 'backward']).optional().default('forward'),
});

export class PaginationUtils {
  static readonly DEFAULT_LIMIT = 20;
  static readonly MAX_LIMIT = 100;

  static encodeCursor(data: CursorData): string {
    try {
      const cursorObj: Record<string, any> = {
        id: data.id,
      };
      if (data.timestamp !== undefined) {
        cursorObj.ts = data.timestamp;
      }
      if (data.sortField !== undefined) {
        cursorObj.sf = data.sortField;
      }
      return Buffer.from(JSON.stringify(cursorObj)).toString('base64url');
    } catch (error) {
      throw new Error('Failed to encode cursor');
    }
  }

  static decodeCursor(cursor: string): CursorData {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.id,
        timestamp: parsed.ts,
        sortField: parsed.sf,
      };
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  static validateParams(params: PaginationParams): {
    limit: number;
    cursor: CursorData | null;
    direction: 'forward' | 'backward';
  } {
    const result = paginationParamsSchema.safeParse(params);
    if (!result.success) {
      throw new Error('Invalid pagination parameters');
    }

    const validated = result.data;
    const cursor = validated.cursor
      ? this.decodeCursor(validated.cursor)
      : null;

    return {
      limit: validated.limit,
      cursor,
      direction: validated.direction,
    };
  }

  static buildCursorCondition<T extends PgTable>(
    table: T,
    cursor: CursorData | null,
    direction: 'forward' | 'backward',
    idColumn: any,
    timestampColumn?: any
  ): SQL | undefined {
    if (!cursor) return undefined;

    if (timestampColumn) {
      if (direction === 'forward') {
        return or(
          lt(timestampColumn, sql`to_timestamp(${cursor.timestamp! / 1000})`),
          and(
            sql`${timestampColumn} = to_timestamp(${cursor.timestamp! / 1000})`,
            gt(idColumn, cursor.id)
          )
        );
      } else {
        return or(
          gt(timestampColumn, sql`to_timestamp(${cursor.timestamp! / 1000})`),
          and(
            sql`${timestampColumn} = to_timestamp(${cursor.timestamp! / 1000})`,
            lt(idColumn, cursor.id)
          )
        );
      }
    } else {
      return direction === 'forward'
        ? gt(idColumn, cursor.id)
        : lt(idColumn, cursor.id);
    }
  }

  static buildResponse<T extends { id: string; createdAt?: Date }>(
    items: T[],
    limit: number,
    direction: 'forward' | 'backward'
  ): PaginatedResponse<T> {
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (data.length > 0) {
      if (direction === 'forward' && hasMore) {
        const lastItem = data[data.length - 1];
        nextCursor = this.encodeCursor({
          id: lastItem.id,
          timestamp: lastItem.createdAt?.getTime(),
        });
      }

      if (direction === 'backward' || data.length === limit) {
        const firstItem = data[0];
        prevCursor = this.encodeCursor({
          id: firstItem.id,
          timestamp: firstItem.createdAt?.getTime(),
        });
      }
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        totalReturned: data.length,
      },
    };
  }

  static async executePaginatedQuery<T extends { id: string; createdAt?: Date }>(
    queryFn: (limit: number, cursorCondition?: SQL) => Promise<T[]>,
    params: PaginationParams
  ): Promise<PaginatedResponse<T>> {
    const { limit, cursor, direction } = this.validateParams(params);

    const cursorCondition = cursor
      ? this.buildCursorCondition(
          {} as any,
          cursor,
          direction,
          sql`id`,
          sql`created_at`
        )
      : undefined;

    const items = await queryFn(limit + 1, cursorCondition);

    return this.buildResponse(items, limit, direction);
  }
}

function or(...conditions: (SQL | undefined)[]): SQL | undefined {
  const validConditions = conditions.filter((c): c is SQL => c !== undefined);
  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];
  return sql`(${sql.join(validConditions, sql` OR `)})`;
}
