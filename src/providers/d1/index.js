import { log } from '../../utils/logger.js';
import { BaseProvider } from '../../utils/BaseProviderClass.js';

class D1Provider extends BaseProvider {
  #logging;
  #db;
  #tableName;
  #dbName;
  #options;

  constructor({ env, dbName, tableName, logging, ...options }) {
    super();
    this.#dbName = dbName ?? 'SESSIONS';
    this.#tableName = tableName ?? 'sessions';
    this.#logging = logging ?? false;
    this.#db = env[dbName];
    this.#options = options;
  }

  async precheck() {
    if (!this.#db) {
      log(
        true,
        'error',
        `D1 Database not found in environment. Please make sure to setup ${this.#dbName} in your wrangler.toml file.`,
      );
      throw new Error(
        `D1 Database not found in environment. Please make sure to setup ${this.#dbName} in your wrangler.toml file.`,
      );
    }
    let total;
    try {
      const res = await this.#db
        .prepare("SELECT count(*) as total FROM sqlite_master WHERE type='table' AND name = ?;")
        .bind(this.#tableName)
        .first();
      total = res.total;
    } catch (error) {
      log(
        this.#logging,
        'error',
        `Error while checking for table ${this.#tableName} in database ${this.#dbName}: `,
        error,
      );
      total = 0;
    }
    if (total === 0) {
      await this.#db
        .prepare(
          `CREATE TABLE IF NOT EXISTS ${this.#tableName} (sid TEXT UNIQUE, data TEXT, expiry INTEGER)`,
        )
        .run();
      log(this.#logging, 'log', `Created table ${this.#tableName} in database ${this.#dbName}`);
    }
  }

  async createSession() {
    const sessionID = crypto.randomUUID();
    log(this.#logging, 'log', `Creating new session with ID ${sessionID}`);
    const maxAge = 60 * 60 * 24 * 365 * 10;
    await this.#db.prepare(`INSERT INTO ${this.#tableName} (sid, data, expiry) VALUES (?, ?, ?)`).bind(sessionID, "{}", Date.now() + maxAge).run();
    return sessionID;
  }

  async getSession(sid) {
    return await this.#db.prepare(`SELECT * FROM ${this.#tableName} WHERE sid = ?`).bind(sid).first();
  }
  
  async setSession(sid, data) {
    log(this.#logging, 'log', `Updating session data for session ID ${sid} with data: `, data);
    await this.#db.prepare(`UPDATE ${this.#tableName} SET data = ? WHERE sid = ?`).bind(JSON.stringify(data), sid).run();
  }
  
  async destroySession(sid) {
    await this.#db.prepare(`DELETE FROM ${this.#tableName} WHERE sid = ?`).bind(sid).run();
  }

};

export default D1Provider;
