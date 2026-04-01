import { Switch, Route } from "wouter";
import TravanaHome from "./home";
import TravanaDestinations from "./destinations";
import TravanaAdvisors from "./advisors";
import TravanaAbout from "./about";
import TravanaContact from "./contact";

export default function TravanaRouter() {
  return (
    <Switch>
      <Route path="/travana" component={TravanaHome} />
      <Route path="/travana/destinations" component={TravanaDestinations} />
      <Route path="/travana/advisors" component={TravanaAdvisors} />
      <Route path="/travana/about" component={TravanaAbout} />
      <Route path="/travana/contact" component={TravanaContact} />
      <Route path="/travana/:rest*" component={TravanaHome} />
    </Switch>
  );
}
