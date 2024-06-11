class ApiResponse {
  statusCode: any;
  data: any;
  message: string;
  success: boolean;

  constructor(statusCode: number, data: any, message?: string) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message || "success";
    this.success = statusCode < 400;
  }
}
export { ApiResponse };
