import axios from "axios";
import { getToken } from "./auth";

export async function payloadRequest<T>(
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const { data } = await axios.request<T>({
    method,
    url: `${process.env.PAYLOAD_HOST}/api${path}`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: body,
  });
  return data;
}
