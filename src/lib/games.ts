import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export type GameFilterOptions = {
    categoryIds?: number[];
    publisherIds?: number[];
};

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function sanitizeFilterIds(ids: number[] | number | null | undefined): number[] {
    const list = Array.isArray(ids) ? ids : ids === undefined || ids === null ? [] : [ids];
    return [...new Set(list.filter((id) => Number.isInteger(id) && id > 0))];
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGamesByFilters(db);
}

/** Games matching any of the supplied category ids, combined with any publisher ids if provided. */
export async function getGamesByFilters(
    db: Database,
    filters: GameFilterOptions = {},
): Promise<Game[]> {
    const categoryIds = sanitizeFilterIds(filters.categoryIds);
    const publisherIds = sanitizeFilterIds(filters.publisherIds);
    const conditions = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }
    if (publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    const rows =
        conditions.length > 0
            ? await baseGamesQuery(db).where(and(...conditions)).orderBy(asc(games.title))
            : await baseGamesQuery(db).orderBy(asc(games.title));

    return rows.map(mapGame);
}

/** Games in the supplied category ids, ordered by title. */
export async function getGamesByCategory(db: Database, categoryIds: number[] | number): Promise<Game[]> {
    return getGamesByFilters(db, { categoryIds: sanitizeFilterIds(categoryIds) });
}

/** Games from the supplied publisher ids, ordered by title. */
export async function getGamesByPublisher(db: Database, publisherIds: number[] | number): Promise<Game[]> {
    return getGamesByFilters(db, { publisherIds: sanitizeFilterIds(publisherIds) });
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
