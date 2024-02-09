class ColumnNumericTransformer {
  to(data) {
    return Number(parseFloat(data).toFixed(2)) || 0;
  }
  from(data) {
    if (data && data != 'NaN') {
      let number = parseFloat(data);
      if (number == 'NaN')
        return 0;
      return Number(number.toFixed(2));
    }
    return 0;
  }
}

exports.ColumnNumericTransformer = ColumnNumericTransformer;