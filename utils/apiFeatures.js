const {
  Brackets,
  Between,
  MoreThan,
  LessThan,
  MoreThanOrEqual,
  LessThanOrEqual,
} = require("typeorm");

class ApiFeature {
  constructor(query, options) {
    this.query = query;
    this.options = options;
  }

  search() {
    if (this.options.keyword) {
      const searchColumns = this?.options?.searchBy?.split(","); // Specify the columns you want to search

      // Implement search logic based on your requirements
      const orConditions = searchColumns
        .map((column) => `${column} ILIKE :search`)
        .join(" OR ");

      this.query.andWhere(
        new Brackets((qb) => {
          qb.where(orConditions, { search: `%${this.options.keyword}%` });
        })
      );
    }
    return this;
  }

  filter() {
    const notFilters = ["searchBy", "keyword", "sort", "page", "limit"];
    let filterObject = {};
    Object.keys(this.options)
      ?.filter((item) => !notFilters.includes(item))
      ?.forEach((item) => {
        filterObject = { ...filterObject, [item]: this.options[item] };
      });
    if (filterObject) {
      // Implement filter logic based on your requirements
      Object.entries(filterObject).forEach(([key, value]) => {
        const [operator, filterValue] = this.parseFilterValue(value);

        if (operator && filterValue !== undefined) {
          // Use different operators for different conditions
          switch (operator) {
            case "eq":
              this.query.andWhere({ [key]: Equal(filterValue) });
              break;
            case "gt":
              this.query.andWhere({ [key]: MoreThan(filterValue) });
              break;
            case "lt":
              this.query.andWhere({ [key]: LessThan(filterValue) });
              break;
            case "gte":
              this.query.andWhere({ [key]: MoreThanOrEqual(filterValue) });
              break;
            case "lte":
              this.query.andWhere({ [key]: LessThanOrEqual(filterValue) });
              break;
            case "between":
              if (filterValue?.split(",")?.length === 2) {
                this.query.andWhere({
                  [key]: Between(
                    filterValue?.split(",")?.[0],
                    filterValue?.split(",")?.[1]
                  ),
                });
              }
              break;
            // Add more cases for other conditions as needed
          }
        } else {
          // Handle equality by default if no operator is specified
          this.query.andWhere(`${key} = :value`, { value });
        }
      });
    }
    return this;
  }

  sort() {
    if (this.options.sort) {
      const sortColumns = this.options.sort.split(",");

      // Implement sorting logic based on your requirements
      sortColumns.forEach((sortColumn) => {
        const [column, order] = sortColumn.split(":");
        if (
          column &&
          order &&
          (order.toUpperCase() === "ASC" || order.toUpperCase() === "DESC")
        ) {
          this.query.addOrderBy(column, order.toUpperCase());
        }
      });
    }
    return this;
  }

  paginate() {
    const page = this.options.page || 1;
    const limit = this.options.limit || 10;
    const skip = (page - 1) * limit;

    this.query.skip(skip).take(limit);

    return this;
  }

  async getResult() {
    // Execute the final query and return the result
    return this.query.getManyAndCount();
  }

  parseFilterValue(value) {
    // Parse the filter value to extract operator and actual value
    const operators = ["eq","gte","lte", "gt", "lt", "between"]; // Add more operators as needed
    const [operator] = operators.filter((op) => value?.startsWith(`${op}`));

    if (operator) {
      const filterValue = value.substring(operator.length);
      return [operator, this.parseFilterValueByType(filterValue)];
    } else {
      // If no operator is specified, treat it as equality
      return [null, this.parseFilterValueByType(value)];
    }
  }

  parseFilterValueByType(value) {
    // Parse the filter value based on its type (e.g., handle string, numeric, etc.)
    // Add more cases as needed
    if (new Date(value) !== "Invalid Date" && !isNaN(new Date(value))) {
      return new Date(value);
    } else if (!isNaN(value)) {
      return parseFloat(value); // Assume it's a number
    } else if (
      value.toLowerCase() === "true" ||
      value.toLowerCase() === "false"
    ) {
      return value.toLowerCase() === "true"; // Assume it's a boolean
    } else {
      return value; // Assume it's a string
    }
  }
}

module.exports = ApiFeature;
