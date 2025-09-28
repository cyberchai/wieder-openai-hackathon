import EditMerchantClient from "./EditMerchantClient";

type Params = { params: Promise<{ id: string }> };

export default async function EditMerchantPage({ params }: Params) {
  const { id } = await params;
  return <EditMerchantClient id={id} />;
}
