import { Route as rootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";

const IndexRouteWithChildren = IndexRoute;
export const routeTree = rootRoute.addChildren([IndexRouteWithChildren]);
