# FleetForge

**Created by Tabish Syed**

FleetForge is an electric-vehicle fleet charging scheduler. It builds a low-cost charging plan while respecting vehicle departure times, battery needs, charger power, and the number of available chargers.

## Run

Open `index.html` in a modern browser. FleetForge is a static project with no build step, account, API key, or external service.

## Use

- Review or change each vehicle's current and target state of charge and departure time.
- Choose a synthetic electricity tariff profile and the number of available chargers.
- Select **Build charging plan** to update the schedule.
- Review planned charging hours, energy, estimated cost, and any vehicle that cannot reach its target before departure.

## Scheduling approach

The planner processes vehicles by earliest departure. For each vehicle, it assigns the cheapest available hourly slots before departure, up to the per-charger power limit and shared charger count. This is a deadline-first greedy heuristic; it is easy to inspect and is not guaranteed to find the global minimum-cost schedule.

## Scope and limits

Vehicle details and electricity prices are simulated examples. The schedule is a planning demonstration, not a live charging control system. It does not connect to vehicles, chargers, utility tariffs, or a fleet backend.

## License

The original project code is available under the MIT License.