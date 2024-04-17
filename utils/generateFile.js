const XLSX = require("xlsx");
const pdfMake = require("pdfmake/build/pdfmake");
const pdfFonts = require("pdfmake/build/vfs_fonts");
const { fileType } = require("../config/contants");

/**
 * A class for generating PDF and Excel reports.
 */
class FileGenerate {
  /**
   * Creates a new instance of FileGenerate.
   *
   * @param {string} reportType - The type of report to generate (e.g., "pdf" or "excel").
   */
  constructor(reportType) {
    this.reportType = reportType;
  }

  /**
   * Generate a report based on the specified type.
   *
   * @param {Array<Object>} formattedData - An array of objects representing report data.
   * @returns {Promise<string>} - The generated report file name.
   */
  async generateReport(formattedData, header) {
    switch (this.reportType) {
      case fileType.pdf:
        return this.generatePdf(formattedData, header);
      case fileType.excel:
        return this.generateExcel(formattedData, header);
      default:
        throw new Error("Unsupported report type");
    }
  }

  /**
   * Generate a PDF report.
   *
   * @param {Array<Object>} formattedData - An array of objects representing report data.
   * @returns {Promise<string>} - The generated PDF file name.
   */
  async generatePdf(formattedData, headers) {
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
    const pdfHeaders = headers.map((item) => {
      return item.excelHeader;
    });

    if (formattedData && formattedData?.length > 0) {
      const rows = formattedData.map((row) =>
        headers.map((item) => {
          return (row[item.dbKey]??"");
        })
      );

      const docDefinition = {
        pageSize: "A3",
        pageOrientation: "landscape",
        content: [
          {
            table: {
              headerRows: 1,
              body: [pdfHeaders, ...rows],
            },
            layout: {
              fillColor: function (rowIndex) {
                return rowIndex % 2 === 0 ? "#CCCCCC" : null; // Alternate row colors for better readability
              },
            },
          },
        ],
      };

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      const pdfBuffer = await new Promise((resolve, reject) => {
        pdfDocGenerator.getBuffer((buffer) => {
            
                resolve(buffer);
        });
    });

      const base64PDF = pdfBuffer.toString("base64");
      return base64PDF;
    }
  }

  /**
   * Generate an Excel report.
   *
   * @param {string} fileName - The base file name for the report.
   * @param {Array<Object>} formattedData - An array of objects representing report data.
   * @returns {Promise<string>} - The generated Excel file name.
   */
  async generateExcel(formattedData, headers) {
    const excelHeaders = headers.map((item) => {
      return item.excelHeader;
    });

    if (formattedData && formattedData?.length > 0) {
      const rows = formattedData.map((row) =>
        headers.map((item) => {
          return row[item.dbKey];
        })
      );

      rows.unshift(excelHeaders);
      const excelWs = XLSX.utils.aoa_to_sheet(rows);
      const excelWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(excelWb, excelWs, "excel");
      const excelBuffer = XLSX.write(excelWb, {
        bookType: "xlsx",
        type: "array",
      });
      // Convert the Uint8Array to a Buffer
      const excelBufferData = Buffer.from(excelBuffer);

      // Encode the Buffer to base64
      const excelBase64 = excelBufferData.toString("base64");

      return excelBase64;
    }
  }
}

module.exports = FileGenerate;
