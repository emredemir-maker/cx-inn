import { useGetCustomers, useGetCustomer } from "@workspace/api-client-react";

export function useCustomersList() {
  return useGetCustomers();
}

export function useCustomerDetail(id: number) {
  return useGetCustomer(id, { query: { enabled: !!id } });
}
