import { policyRoute } from "@/components/layout/policy-page";

const route = policyRoute("checkIn", "/check-in-policy");
export const generateMetadata = route.generateMetadata;
export default route.Page;
