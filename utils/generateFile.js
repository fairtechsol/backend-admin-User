const XLSX = require("xlsx");
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

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
  async generateReport( formattedData) {
    switch (this.reportType) {
      case "pdf":
        return this.generatePdf(formattedData);
      case "excel":
        return this.generateExcel(formattedData);
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
  async generatePdf(formattedData) {
    pdfMake.vfs = pdfFonts.pdfMake.vfs;

    if (formattedData && formattedData.length > 0) {
      const headers = Object.keys(formattedData[0]);
      const rows = formattedData.map((row) =>
        Object.values(row)?.map((item) => (item === null ? "" : item))
      );

      var docDefinition = 
       
          {
            pageSize: 'A3',
            pageOrientation: 'landscape',
            content: [
                {
                    table: {
                        headerRows: 1,
                        body: [
                            headers,
                            ...rows,
                        ],
                    },
                    layout: {
                        fillColor: function (rowIndex) {
                            return rowIndex % 2 === 0 ? '#CCCCCC' : null; // Alternate row colors for better readability
                        },
                    },
                },
            ],
          };

      const pdfDocGenerator = pdfMake.createPdf(docDefinition);

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          pdfDocGenerator.getBuffer((buffer) => {
              resolve(buffer);
          });
      });

      const base64PDF = pdfBuffer.toString('base64');
      return Buffer.from(base64PDF, 'base64');
    }
  }

 
  /**
   * Generate an Excel report.
   *
   * @param {string} fileName - The base file name for the report.
   * @param {Array<Object>} formattedData - An array of objects representing report data.
   * @returns {Promise<string>} - The generated Excel file name.
   */
  async generateExcel(formattedData) {

    const excelWs = XLSX.utils.json_to_sheet(formattedData);
    const excelWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(excelWb, excelWs, fileName);
    const excelBuffer = XLSX.write(excelWb, {
      bookType: "csv",
      type: "array",
    });
    // Convert the Uint8Array to a Buffer
    const excelBufferData = Buffer.from(excelBuffer);

    // Encode the Buffer to base64
    const excelBase64 = excelBufferData.toString("base64");

    return excelBase64;
  }
}

module.exports = FileGenerate;