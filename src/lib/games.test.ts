import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByCategory,
    getGamesByFilters,
    getGamesByPublisher,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilteredGames(db: Database): Promise<void> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Time-based planning' })
        .returning({ id: categories.id });
    const [adventure] = await db
        .insert(categories)
        .values({ name: 'Adventure', description: 'Exploration' })
        .returning({ id: categories.id });
    const [northStar] = await db
        .insert(publishers)
        .values({ name: 'North Star Games', description: 'Indie publisher' })
        .returning({ id: publishers.id });
    const [pixelForge] = await db
        .insert(publishers)
        .values({ name: 'Pixel Forge', description: 'Retro studio' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        { title: 'Aether Tactics', description: 'Strategy title', starRating: 4.8, categoryId: strategy.id, publisherId: northStar.id },
        { title: 'Cinder Dungeons', description: 'Adventure title', starRating: 4.2, categoryId: adventure.id, publisherId: northStar.id },
        { title: 'Nova Circuit', description: 'Strategy title', starRating: 4.5, categoryId: strategy.id, publisherId: pixelForge.id },
        { title: 'Sunken Vault', description: 'Adventure title', starRating: 3.9, categoryId: adventure.id, publisherId: pixelForge.id },
    ]);
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by category ids', async () => {
        await seedFilteredGames(db);
        const categoryId = (await db.select({ id: categories.id }).from(categories).where(eq(categories.name, 'Strategy'))).at(0)?.id;
        expect(categoryId).toBeDefined();

        const filtered = await getGamesByCategory(db, categoryId!);
        expect(filtered.map((game) => game.title)).toEqual(['Aether Tactics', 'Nova Circuit']);
    });

    it('filters games by publisher ids', async () => {
        await seedFilteredGames(db);
        const publisherId = (await db.select({ id: publishers.id }).from(publishers).where(eq(publishers.name, 'North Star Games'))).at(0)?.id;
        expect(publisherId).toBeDefined();

        const filtered = await getGamesByPublisher(db, publisherId!);
        expect(filtered.map((game) => game.title)).toEqual(['Aether Tactics', 'Cinder Dungeons']);
    });

    it('combines category and publisher filters', async () => {
        await seedFilteredGames(db);
        const categoryId = (await db.select({ id: categories.id }).from(categories).where(eq(categories.name, 'Strategy'))).at(0)?.id;
        const publisherId = (await db.select({ id: publishers.id }).from(publishers).where(eq(publishers.name, 'North Star Games'))).at(0)?.id;

        const filtered = await getGamesByFilters(db, {
            categoryIds: [categoryId!],
            publisherIds: [publisherId!],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Aether Tactics']);
    });
});
