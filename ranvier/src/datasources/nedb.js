const Datastore = require('nedb');
const path = require('path');

class NedbDataSource {
  constructor(config) {
    this.config = config;
    this.db = new Datastore({
      filename: path.resolve(config.path || './data/characters.db'),
      autoload: true
    });
  }

  async save(type, id, data) {
    return new Promise((resolve, reject) => {
      const doc = {
        _id: `${type}:${id}`,
        type: type,
        id: id,
        data: data,
        updatedAt: new Date()
      };

      this.db.update(
        { _id: doc._id },
        doc,
        { upsert: true },
        (err, numReplaced, upserted) => {
          if (err) {
            reject(err);
          } else {
            resolve(upserted || { _id: doc._id });
          }
        }
      );
    });
  }

  async load(type, id) {
    return new Promise((resolve, reject) => {
      this.db.findOne({ _id: `${type}:${id}` }, (err, doc) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc ? doc.data : null);
        }
      });
    });
  }

  async loadAll(type) {
    return new Promise((resolve, reject) => {
      this.db.find({ type: type }, (err, docs) => {
        if (err) {
          reject(err);
        } else {
          const results = {};
          docs.forEach(doc => {
            results[doc.id] = doc.data;
          });
          resolve(results);
        }
      });
    });
  }

  async delete(type, id) {
    return new Promise((resolve, reject) => {
      this.db.remove({ _id: `${type}:${id}` }, {}, (err, numRemoved) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved > 0);
        }
      });
    });
  }

  async replace(type, id, data) {
    return this.save(type, id, data);
  }
}

module.exports = NedbDataSource;