export interface ApiFieldError {
  field: string;
  code: string;
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  errors?: ApiFieldError[];
}