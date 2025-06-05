import axios from "axios";

export async function getToken() {
  const { data } = await axios.post(
    `${process.env.PAYLOAD_HOST}/api/users/login`,
    {
      email: process.env.PAYLOAD_USERNAME,
      password: process.env.PAYLOAD_PASSWORD,
    }
  );
  return data.token as string;
}
