class ColumnNumericTransformer {
    to(data) {
      return data;
    }
    from(data) {
      if (data && data != 'NaN') return parseFloat(data).toFixed(2);
      return 0;
    }
  }
  
  exports.ColumnNumericTransformer = ColumnNumericTransformer;