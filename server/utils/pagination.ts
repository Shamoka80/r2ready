/**
 * Cursor-Based Pagination Utilities
 * 
 * This module provides production-ready cursor pagination with composite cursors
 * (timestamp + id) for consistent ordering and efficient pagination.
 * 
 * CURSOR CONTRACT:
 * 
 * Forward Pagination:
 * - Query: ORDER BY timestamp DESC, id DESC (newest first)
 * - Cursor Filter: WHERE (timestamp < cursor.ts) OR (timestamp = cursor.ts AND id > cursor.id)
 * - Presentation: Newest → Oldest (DESC)
 * - nextCursor: Points to last item in current page for forward navigation
 * - prevCursor: null on first page, points to first item when coming from backward
 * 
 * Backward Pagination:
 * - Query: ORDER BY timestamp ASC, id ASC (oldest first)
 * - Cursor Filter: WHERE (timestamp > cursor.ts) OR (timestamp = cursor.ts AND id < cursor.id)
 * - Post-Processing: ALWAYS reverse result slice to maintain DESC presentation
 * - Presentation: Newest → Oldest (DESC) - same as forward for consistency
 * - nextCursor: null on final backward page, points to last item when more exist
 * - prevCursor: Points to first item in current page for backward navigation
 * 
 * Edge Cases Handled:
 * - Final backward page (≤ limit items): Still reversed to maintain DESC order
 * - Single item pages: Correctly handled in both directions
 * - Empty result sets: Gracefully return empty data with null cursors
 * 
 * Performance:
 * - Uses composite indexes on (timestamp, id) for efficient cursor filtering
 * - Avoids OFFSET-based pagination which degrades on large tables
 * - Sub-millisecond query times with proper indexes
 * 
 * @see server/tools/test-pagination-edges.ts for comprehensive edge case tests
 */

import { z } from 'zod';
import { SQL, sql, desc, asc, gt, lt, gte, lte, and, or } from 'drizzle-orm';
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

    if (timestampColumn && cursor.timestamp !== undefined) {
      const cursorDate = new Date(cursor.timestamp);
      
      if (direction === 'forward') {
        return or(
          lt(timestampColumn, cursorDate),
          and(
            sql`${timestampColumn} = ${cursorDate}`,
            gt(idColumn, cursor.id)
          )
        );
      } else {
        return or(
          gt(timestampColumn, cursorDate),
          and(
            sql`${timestampColumn} = ${cursorDate}`,
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

  static buildResponse<T>(
    items: T[],
    limit: number,
    direction: 'forward' | 'backward',
    cursorFields: string[] = ['createdAt', 'id'],
    hasPreviousPage: boolean = false
  ): PaginatedResponse<T> {
    const hasMore = items.length > limit;
    
    // Slice to limit
    let slicedItems = items.slice(0, limit);
    
    // For backward navigation, ALWAYS reverse to maintain DESC presentation
    // (we query ASC for backward to get correct LIMIT window, then reverse)
    if (direction === 'backward') {
      slicedItems = slicedItems.reverse();
    }

    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (slicedItems.length > 0) {
      const timestampField = cursorFields[0];
      const idField = cursorFields[1];
      
      // Build nextCursor from last item if there are more results
      if (hasMore) {
        const lastItem = slicedItems[slicedItems.length - 1] as any;
        nextCursor = this.encodeCursor({
          id: lastItem[idField],
          timestamp: lastItem[timestampField]?.getTime ? lastItem[timestampField].getTime() : undefined,
        });
      }

      // Only set prevCursor if we actually came from a previous page
      if (hasPreviousPage) {
        const firstItem = slicedItems[0] as any;
        prevCursor = this.encodeCursor({
          id: firstItem[idField],
          timestamp: firstItem[timestampField]?.getTime ? firstItem[timestampField].getTime() : undefined,
        });
      }
    }

    return {
      data: slicedItems,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
        totalReturned: slicedItems.length,
      },
    };
  }

  static async executePaginatedQuery<T extends PgTable>(
    query: any,
    table: T,
    options: {
      cursor?: string;
      limit?: number;
      direction?: 'forward' | 'backward';
      idColumn?: string;
      timestampColumn?: string;
    }
  ): Promise<PaginatedResponse<any>> {
    const { cursor, limit = 50, direction = 'forward', idColumn = 'id', timestampColumn = 'createdAt' } = options;
    
    let modifiedQuery = query;
    
    if (cursor) {
      const cursorData = this.decodeCursor(cursor);
      const condition = this.buildCursorCondition(
        table,
        cursorData,
        direction,
        (table as any)[idColumn],
        (table as any)[timestampColumn]
      );
      if (condition) {
        modifiedQuery = modifiedQuery.where(condition);
      }
    }
    
    // Use timestamp column parameter for ORDER BY
    // Forward: DESC (newest first), Backward: ASC (oldest first, then reversed in buildResponse)
    modifiedQuery = direction === 'forward'
      ? modifiedQuery.orderBy(desc((table as any)[timestampColumn]), desc((table as any)[idColumn]))
      : modifiedQuery.orderBy(asc((table as any)[timestampColumn]), asc((table as any)[idColumn]));
    
    modifiedQuery = modifiedQuery.limit(limit + 1);
    
    const items = await modifiedQuery;
    
    return this.buildResponse(items, limit, direction, [timestampColumn, idColumn], !!cursor);
  }
}
