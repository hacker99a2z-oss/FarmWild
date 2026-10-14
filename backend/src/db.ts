import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj) return undefined;
  if (!path.includes(".")) return obj[path];
  const parts = path.split(".");
  let cur: any = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const parts = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]!] = value;
}

function incNestedValue(obj: Record<string, any>, path: string, amount: number): void {
  const current = getNestedValue(obj, path) ?? 0;
  setNestedValue(obj, path, Number(current) + amount);
}

function unsetNestedValue(obj: Record<string, any>, path: string): void {
  const parts = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cur == null) return;
    cur = cur[part];
  }
  if (cur) {
    delete cur[parts[parts.length - 1]!];
  }
}

function matchesFilter(doc: Record<string, any>, filter: Record<string, any>): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = getNestedValue(doc, key);
    if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
      if ("$gte" in expected && (actual == null || actual < expected.$gte)) return false;
      if ("$lt" in expected && (actual == null || actual >= expected.$lt)) return false;
      if ("$in" in expected && Array.isArray(expected.$in) && !expected.$in.includes(actual)) return false;
      if ("$exists" in expected) {
        const exists = actual !== undefined;
        if (expected.$exists !== exists) return false;
      }
    } else {
      if (actual instanceof Date && expected instanceof Date) {
        if (actual.getTime() !== expected.getTime()) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
  }
  return true;
}

function applyUpdate(doc: Record<string, any>, update: Record<string, any>, isInsert = false): void {
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      setNestedValue(doc, k, v);
    }
  }
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      incNestedValue(doc, k, v as number);
    }
  }
  if (update.$unset) {
    for (const k of Object.keys(update.$unset)) {
      unsetNestedValue(doc, k);
    }
  }
  if (isInsert && update.$setOnInsert) {
    for (const [k, v] of Object.entries(update.$setOnInsert)) {
      setNestedValue(doc, k, v);
    }
  }
}

class MockCollection<T extends Record<string, any>> {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  private getStore(): Map<any, T> {
    const g = globalThis as unknown as { __mockMongoDb?: Map<string, Map<any, any>> };
    if (!g.__mockMongoDb) {
      g.__mockMongoDb = new Map();
    }
    if (!g.__mockMongoDb.has(this.collectionName)) {
      g.__mockMongoDb.set(this.collectionName, new Map());
    }
    return g.__mockMongoDb.get(this.collectionName)!;
  }

  async findOne(filter: Record<string, any>): Promise<T | null> {
    const store = this.getStore();
    for (const doc of store.values()) {
      if (matchesFilter(doc, filter)) {
        return JSON.parse(JSON.stringify(doc));
      }
    }
    return null;
  }

  find(filter: Record<string, any> = {}) {
    const store = this.getStore();
    const results: T[] = [];
    for (const doc of store.values()) {
      if (matchesFilter(doc, filter)) {
        results.push(JSON.parse(JSON.stringify(doc)));
      }
    }

    return {
      sort: (sortObj: Record<string, number>) => {
        const [field, dir] = Object.entries(sortObj)[0] ?? [];
        if (field) {
          results.sort((a, b) => {
            const valA = getNestedValue(a, field);
            const valB = getNestedValue(b, field);
            const numA = valA instanceof Date ? valA.getTime() : typeof valA === "number" ? valA : 0;
            const numB = valB instanceof Date ? valB.getTime() : typeof valB === "number" ? valB : 0;
            return dir === -1 ? numB - numA : numA - numB;
          });
        }
        return {
          limit: (n: number) => ({
            toArray: async () => results.slice(0, n),
          }),
          toArray: async () => results,
        };
      },
      limit: (n: number) => ({
        toArray: async () => results.slice(0, n),
      }),
      toArray: async () => results,
    };
  }

  async insertOne(doc: T): Promise<{ insertedId: any }> {
    const store = this.getStore();
    const item: any = { ...doc };
    if (item._id == null) {
      item._id = crypto.randomUUID();
    }
    store.set(item._id, item);
    return { insertedId: item._id };
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>, options?: { upsert?: boolean }): Promise<{ matchedCount: number; modifiedCount: number }> {
    const store = this.getStore();
    for (const [id, doc] of store.entries()) {
      if (matchesFilter(doc, filter)) {
        applyUpdate(doc, update, false);
        return { matchedCount: 1, modifiedCount: 1 };
      }
    }
    if (options?.upsert) {
      const newDoc: any = { ...filter };
      applyUpdate(newDoc, update, true);
      if (newDoc._id == null) newDoc._id = crypto.randomUUID();
      store.set(newDoc._id, newDoc);
      return { matchedCount: 0, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>): Promise<{ matchedCount: number; modifiedCount: number }> {
    const store = this.getStore();
    let count = 0;
    for (const doc of store.values()) {
      if (matchesFilter(doc, filter)) {
        applyUpdate(doc, update, false);
        count++;
      }
    }
    return { matchedCount: count, modifiedCount: count };
  }

  async findOneAndUpdate(filter: Record<string, any>, update: Record<string, any>, options?: { returnDocument?: "before" | "after"; upsert?: boolean }): Promise<T | null> {
    const store = this.getStore();
    for (const [id, doc] of store.entries()) {
      if (matchesFilter(doc, filter)) {
        const before = JSON.parse(JSON.stringify(doc));
        applyUpdate(doc, update, false);
        return options?.returnDocument === "after" ? JSON.parse(JSON.stringify(doc)) : before;
      }
    }
    if (options?.upsert) {
      const newDoc: any = { ...filter };
      applyUpdate(newDoc, update, true);
      if (newDoc._id == null) newDoc._id = crypto.randomUUID();
      store.set(newDoc._id, newDoc);
      return options?.returnDocument === "after" ? JSON.parse(JSON.stringify(newDoc)) : null;
    }
    return null;
  }

  async countDocuments(filter: Record<string, any> = {}): Promise<number> {
    const store = this.getStore();
    let count = 0;
    for (const doc of store.values()) {
      if (matchesFilter(doc, filter)) count++;
    }
    return count;
  }
}

class MockDb {
  collection<T extends Record<string, any>>(name: string): MockCollection<T> {
    return new MockCollection<T>(name);
  }
}

const mockDbInstance = new MockDb() as unknown as Db;

export async function getDb(): Promise<Db> {
  const uri = process.env["MONGODB_URI"];
  if (!uri) {
    return mockDbInstance;
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((e) => {
        console.warn("[Backend] MongoDB connection failed, using in-memory store:", e.message);
        clientPromise = null;
        return null as unknown as MongoClient;
      });
  }
  try {
    const client = await clientPromise;
    if (client) {
      return client.db(process.env["MONGODB_DB"] ?? "farmcity");
    }
  } catch (err) {
    console.warn("[Backend] MongoDB error, using in-memory store");
  }
  return mockDbInstance;
}
