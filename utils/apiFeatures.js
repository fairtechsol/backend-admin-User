const { EntityRepository, Repository, Like } = require("typeorm");

class ApiFeatures {
  constructor(entityRepository, query) {
    this.entityRepository = entityRepository;
    this.query = query;
  }

  async search() {
    const results = await this.entityRepository.find({
      where: {
        [this.query.searchBy]: Like(`%${this.query.keyword}%`),
      },
    });
    return results;
  }

//   async filter(filters) {
//     const results = await this.entityRepository.find({
//       where: filters,
//     });
//     return results;
//   }

  async sort() {
    const results = await this.entityRepository.find({
      order: {
        [this.query.sortBy]: this.query.sortOrder || "ASC",
      },
    });
    return results;
  }

  async paginate() {
    const skip = (this.query.page - 1) * this.query.limit;
    const results = await this.entityRepository.find({
      skip,
      take: this.query.limit,
    });
    return results;
  }
}

module.exports = ApiFeatures;
