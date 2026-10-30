/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
	const responseEvent = (resource) => `aicore:cbr:${resource}`;

// ../../../packages/lib/src/shared/wait.ts
/**
	* Resolves with the first value `check` returns that is not undefined, checking once per tick.
	* Rejects after `timeoutMs` (default 10 s); pass `false` to wait forever.
	* Return `cond || undefined` from `check` to wait for a truthy condition.
	*/
	function waitFor(check, timeoutMs = 1e4) {
		return new Promise((resolve, reject) => {
			const started = Date.now();
			const poll = () => {
				const value = check();
				if (value !== void 0) return resolve(value);
				if (timeoutMs !== false && Date.now() - started > timeoutMs) return reject(/* @__PURE__ */ new Error(`waitFor timed out after ${timeoutMs} ms`));
				setTimeout(poll, 0);
			};
			poll();
		});
	}

// ../../../packages/lib/src/shared/vehicleProps.ts
	const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
	const nums = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number") ? v : null;
	/** Stored or received props, checked; null when the shape is not ours. */
	function toVehicleProps(v) {
		if (!isObj(v) || v.v !== 1 || typeof v.model !== "number" || typeof v.plate !== "string") return null;
		const colors = nums(v.colors, 2);
		const extraColors = nums(v.extraColors, 2);
		const neonColor = nums(v.neonColor, 3);
		const tyreSmoke = nums(v.tyreSmoke, 3);
		if (!colors || !extraColors || !neonColor || !tyreSmoke || !isObj(v.mods) || !isObj(v.extras) || !Array.isArray(v.neon)) return null;
		const mods = {};
		for (const [k, x] of Object.entries(v.mods)) if (typeof x === "number") mods[Number(k)] = x;
		const extras = {};
		for (const [k, x] of Object.entries(v.extras)) if (typeof x === "boolean") extras[Number(k)] = x;
		const n = (x, d) => typeof x === "number" ? x : d;
		const rgb = (x) => nums(x, 3);
		return {
			v: 1,
			model: v.model,
			plate: v.plate.slice(0, 8),
			plateIndex: n(v.plateIndex, 0),
			colors: [colors[0] ?? 0, colors[1] ?? 0],
			extraColors: [extraColors[0] ?? 0, extraColors[1] ?? 0],
			customPrimary: rgb(v.customPrimary),
			customSecondary: rgb(v.customSecondary),
			wheelType: n(v.wheelType, 0),
			windowTint: n(v.windowTint, -1),
			livery: n(v.livery, -1),
			mods,
			xenonColor: n(v.xenonColor, 255),
			neon: [
				0,
				1,
				2,
				3
			].map((i) => v.neon instanceof Array && v.neon[i] === true),
			neonColor: [
				neonColor[0] ?? 255,
				neonColor[1] ?? 0,
				neonColor[2] ?? 255
			],
			tyreSmoke: [
				tyreSmoke[0] ?? 255,
				tyreSmoke[1] ?? 255,
				tyreSmoke[2] ?? 255
			],
			extras,
			dirt: n(v.dirt, 0),
			engineHealth: n(v.engineHealth, 1e3),
			bodyHealth: n(v.bodyHealth, 1e3)
		};
	}

// ../../../packages/lib/src/shared/index.ts
/** Console output prefixed with the resource name, so server logs show where a line came from. */
	function createLogger(resource) {
		const prefix = `[${resource}]`;
		return {
			info: (message, ...details) => console.log(`${prefix} ${message}`, ...details),
			warn: (message, ...details) => console.warn(`${prefix} ^3${message}^7`, ...details),
			error: (message, ...details) => console.error(`${prefix} ^1${message}^7`, ...details)
		};
	}

// ../../../packages/lib/src/client/netEvent.ts
	const log$4 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);

// ../../../packages/lib/src/client/callback.ts
	const resource$1 = GetCurrentResourceName();
	const log$3 = createLogger(resource$1);
	const pending = /* @__PURE__ */ new Map();
	onNet(responseEvent(resource$1), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});

// ../../../packages/shared/src/core.ts
/** Names owned by ai-core that other resources, the bridges and the build step use. */
	const CORE = {
		resource: "ai-core",
		/** Client -> server: (resource: string, text: string). Sent by the reporter every client bundle carries. */
		clientErrorEvent: "ai-core:clientError",
		/** (src, character: CharacterInfo) after a character is loaded and spawned. */
		playerLoadedEvent: "ai-core:playerLoaded",
		/** (src, charId, reason: UnloadReason) before a character's state is dropped. */
		playerUnloadedEvent: "ai-core:playerUnloaded",
		/** (src, account: string, balance: number, delta: number, reason: string) */
		moneyChangedEvent: "ai-core:moneyChanged",
		/** (src, jobs: JobMembership[]) */
		jobsChangedEvent: "ai-core:jobsChanged",
		/** (src, job: string | null) */
		dutyChangedEvent: "ai-core:dutyChanged",
		/** (src, gangs: GangMembership[]) */
		gangsChangedEvent: "ai-core:gangsChanged",
		/** (src, gang: string | null) */
		activeGangChangedEvent: "ai-core:activeGangChanged",
		/** (src, charIds: number[]) each time a player's character screen loads; an appearance resource answers with portraits. */
		characterScreenEvent: "ai-core:characterScreen",
		/** (resource: string | null) the inventory behind ai-core's inventory layer changed (the bridge drops its item cache). */
		inventoryChangedEvent: "ai-core:inventoryChanged",
		/** (src, name: string, status: Record<string, number> | null) a player used an item; status = the needs it gives, from inventories that define them. */
		itemUsedEvent: "ai-core:itemUsed",
		/** (src, killer: number | null, weaponHash: number) a player with a loaded character died; fired from FXServer's `onPedDeath` (needs `PED_DEATH_STATE_KEY`). */
		playerDiedEvent: "ai-core:playerDied",
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (charId: number) ai-appearance holds this character's look: ai-core dresses its scene ped with `ApplyCharacterAppearance`. */
		clientCharacterLookEvent: "ai-core:client:characterLook",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
		/** Server -> client callback: (model: string) the `CreateVehicleServerSetter` type of a model, null when the game has no such vehicle (ai-core's client answers for every resource, lib `spawnVehicle`). */
		vehicleTypeCallback: "ai-core:vehicleType",
		/** GlobalState: "prompt" | "target", how lib `Points` let players interact (ai-core panel setting). */
		interactionStateKey: "ai:interaction",
		charactersCallback: "ai-core:characters",
		createCharacterCallback: "ai-core:createCharacter",
		deleteCharacterCallback: "ai-core:deleteCharacter",
		selectCharacterCallback: "ai-core:selectCharacter",
		/** Server -> client: (notification: Notification) a notification card on the player's screen. */
		clientNotifyEvent: "ai-core:client:notify",
		/** Server -> client: (spawn: SpawnPoint) puts the loaded character into the world. */
		spawnEvent: "ai-core:client:spawn",
		/** Server -> client: () the character was let go (switch); show the character screen again. */
		openCharactersEvent: "ai-core:client:openCharacters"
	};

// ../../../packages/shared/src/vehicles.ts
/** Entity state bags ai-vehicles sets on a spawned owned vehicle. */
	const VEHICLE_BAGS = {
		/** true: an owned vehicle. */
		owned: "ai:owned",
		/** Its id in ai-vehicles. */
		id: "ai:vid",
		/** VehicleProps; the entity's owner client applies them. */
		props: "ai:props",
		/** 0-100, kept by a fuel resource. */
		fuel: "fuel"
	};

// ../../../packages/shared/src/menu.ts
	const MENU_EVENTS = {
		/** Client local: (resource, requestId, itemId | null) the player picked an item or closed the menu. */
		menuResult: "ai-core:client:menuResult",
		/** Client local: (resource, requestId, itemId) the pointer or focus is on an item (previews). */
		menuHover: "ai-core:client:menuHover",
		/** Client local: (resource, requestId, values | null) the player confirmed or closed the input dialog. */
		inputResult: "ai-core:client:inputResult"
	};

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The weapon in a ped's hand, `false` when unarmed. */
	function readWeapon(ped) {
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return weapon === UNARMED ? false : weapon;
	}
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		return {
			vehicle: vehicle || false,
			seat,
			weapon: readWeapon(ped)
		};
	}
	/**
	* The local player's often read values (ped, player id, server id, vehicle, seat, weapon), like ox_lib's `cache`:
	* read `cache.ped` instead of calling PlayerPedId() in loops. One watcher in ai-core updates every resource through
	* a local event, so no resource polls for these itself. Read only.
	*/
	const ped = PlayerPedId();
	const cache = {
		ped,
		playerId: PlayerId(),
		serverId: GetPlayerServerId(PlayerId()),
		...readPlayerState(ped)
	};
	const handlers = /* @__PURE__ */ new Map();
	const valid = (key, value) => key === "ped" || key === "playerId" || key === "serverId" ? typeof value === "number" : typeof value === "number" || value === false;
	on(CORE.clientCacheEvent, (key, value) => {
		if (typeof key !== "string" || !(key in cache)) return;
		const name = key;
		if (!valid(name, value) || cache[name] === value) return;
		const old = cache[name];
		cache[name] = value;
		for (const handler of handlers.get(name) ?? []) handler(value, old);
	});

// ../../../packages/lib/src/client/zones.ts
/**
	* Zones on this client: inside / outside checks at each zone's own interval, never per frame. Built for any count
	* (measured with 1,000,000 zones): zones sit in a grid of 64 m cells and a check looks only at the player's cell and
	* the zones the player is in.
	*/
	const log$2 = createLogger(GetCurrentResourceName());
	const CELL = 64;
	/** A zone wider than this many cells is kept in one list checked every time instead of in the grid. */
	const MAX_CELLS = 64;
	const cellKey = (cx, cy) => cx + 32768 << 16 | cy + 32768;
	function contains(shape, x, y, z) {
		switch (shape.type) {
			case "sphere": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				const dz = z - shape.center.z;
				return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
			}
			case "cylinder": {
				const dx = x - shape.center.x;
				const dy = y - shape.center.y;
				return dx * dx + dy * dy <= shape.radius * shape.radius && Math.abs(z - shape.center.z) <= shape.height;
			}
			case "poly": {
				if (z < shape.minZ || z > shape.maxZ) return false;
				let inside = false;
				const p = shape.points;
				for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
					const a = p[i];
					const b = p[j];
					if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
				}
				return inside;
			}
			default: return shape;
		}
	}
	/** Ground bounding box of a shape: [minX, minY, maxX, maxY]. */
	function bounds(shape) {
		if (shape.type !== "poly") return [
			shape.center.x - shape.radius,
			shape.center.y - shape.radius,
			shape.center.x + shape.radius,
			shape.center.y + shape.radius
		];
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const p of shape.points) {
			minX = Math.min(minX, p.x);
			minY = Math.min(minY, p.y);
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
		return [
			minX,
			minY,
			maxX,
			maxY
		];
	}
	var Zone = class {
		options;
		inside = false;
		nextCheck = 0;
		interval;
		/** Grid cells the zone is filed under; empty when it is in the large list. */
		cells = [];
		constructor(options) {
			this.options = options;
			this.interval = Math.max(50, options.interval ?? 500);
		}
	};
	/**
	* The zones of one resource. One timer serves them all at the shortest interval any zone asks for; each zone is
	* checked only when its own interval has passed. With no zones the timer stops (an active JS timer costs every frame).
	*/
	var Zones = class {
		zones = /* @__PURE__ */ new Map();
		grid = /* @__PURE__ */ new Map();
		large = /* @__PURE__ */ new Set();
		insideNow = /* @__PURE__ */ new Set();
		/** How many zones use each interval, so the shortest one is found without walking every zone. */
		intervals = /* @__PURE__ */ new Map();
		timer = null;
		period = 0;
		/** Adds (or replaces) a zone. A replaced zone the player was in fires its onExit first. */
		add(id, options) {
			this.remove(id);
			const zone = new Zone(options);
			this.zones.set(id, zone);
			const [minX, minY, maxX, maxY] = bounds(options.shape);
			const x0 = Math.floor(minX / CELL);
			const y0 = Math.floor(minY / CELL);
			const x1 = Math.floor(maxX / CELL);
			const y1 = Math.floor(maxY / CELL);
			if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) this.large.add(zone);
			else for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
				const key = cellKey(cx, cy);
				let cell = this.grid.get(key);
				if (!cell) this.grid.set(key, cell = /* @__PURE__ */ new Set());
				cell.add(zone);
				zone.cells.push(key);
			}
			this.intervals.set(zone.interval, (this.intervals.get(zone.interval) ?? 0) + 1);
			this.schedule();
		}
		remove(id) {
			const zone = this.zones.get(id);
			if (!zone) return;
			this.zones.delete(id);
			this.large.delete(zone);
			for (const key of zone.cells) {
				const cell = this.grid.get(key);
				cell?.delete(zone);
				if (cell?.size === 0) this.grid.delete(key);
			}
			const left = (this.intervals.get(zone.interval) ?? 1) - 1;
			if (left > 0) this.intervals.set(zone.interval, left);
			else this.intervals.delete(zone.interval);
			if (this.insideNow.delete(zone)) this.fire(zone, false);
			this.schedule();
		}
		/** Removes every zone (exits fire for the ones the player is in). */
		clear() {
			const inside = [...this.insideNow];
			this.zones.clear();
			this.grid.clear();
			this.large.clear();
			this.insideNow.clear();
			this.intervals.clear();
			for (const zone of inside) this.fire(zone, false);
			this.schedule();
		}
		isInside(id) {
			return this.zones.get(id)?.inside ?? false;
		}
		get size() {
			return this.zones.size;
		}
		schedule() {
			let period = 0;
			for (const interval of this.intervals.keys()) period = period === 0 ? interval : Math.min(period, interval);
			if (period === this.period) return;
			if (this.timer) clearInterval(this.timer);
			this.timer = period ? setInterval(() => this.check(), period) : null;
			this.period = period;
		}
		check() {
			const now = GetGameTimer();
			const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
			for (const zone of this.insideNow) this.test(zone, now, x, y, z);
			for (const zone of this.large) this.test(zone, now, x, y, z);
			const cell = this.grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
			if (cell) for (const zone of cell) this.test(zone, now, x, y, z);
		}
		test(zone, now, x, y, z) {
			if (now < zone.nextCheck) return;
			zone.nextCheck = now + zone.interval;
			const inside = contains(zone.options.shape, x, y, z);
			if (inside === zone.inside) return;
			if (inside) this.insideNow.add(zone);
			else this.insideNow.delete(zone);
			this.fire(zone, inside);
		}
		fire(zone, inside) {
			zone.inside = inside;
			try {
				if (inside) zone.options.onEnter?.();
				else zone.options.onExit?.();
			} catch (error) {
				log$2.error("zone handler failed", error);
			}
		}
	};

// ../../../packages/lib/src/fivem/exports.ts
/** Typed access to another resource's exports (types come from CitizenExports in @aicore-fivem/shared). */
	function resourceExport(resource) {
		return globalThis.exports[resource];
	}

// ../../../packages/lib/src/client/prompt.ts
	const core$3 = resourceExport(CORE.resource);
	/** The player pressed the interaction key while this resource's prompt `id` was the one on top. */
	function onPromptPressed(handler) {
		const resource = GetCurrentResourceName();
		on(CORE.clientPromptPressedEvent, (owner, id) => {
			if (owner === resource && typeof id === "string") handler(id);
		});
	}

// ../../../packages/lib/src/client/blip.ts
	const LABEL = `AI_BLIP_${GetCurrentResourceName()}`;
	AddTextEntry(LABEL, "~a~");

// ../../../packages/lib/src/client/localPed.ts
	const log$1 = createLogger(GetCurrentResourceName());
	/** One zone set for every local ped of this resource: peds exist only while their player is near. */
	const zones = new Zones();
	on("onResourceStop", (resource) => {
		if (resource === GetCurrentResourceName()) zones.clear();
	});

// ../../../packages/lib/src/client/point.ts
	const log = createLogger(GetCurrentResourceName());
	const TARGET = "ox_target";
	const groups = /* @__PURE__ */ new Set();
	const byPrompt = /* @__PURE__ */ new Map();
	onPromptPressed((id) => byPrompt.get(id)?.press());
	const restyleAll = () => {
		for (const group of groups) group.restyle();
	};
	AddStateBagChangeHandler(CORE.interactionStateKey, "global", () => setTimeout(restyleAll, 0));
	for (const event of ["onClientResourceStart", "onClientResourceStop"]) on(event, (resource) => {
		if (resource === TARGET || resource === "ai-target") setTimeout(restyleAll, 0);
	});

// ../../../packages/lib/src/client/notify.ts
	const core$2 = resourceExport(CORE.resource);

// ../../../packages/lib/src/client/menu.ts
	const core$1 = resourceExport(CORE.resource);
	/** Menus and input dialogs this resource asked ai-core for, waiting for the player's answer. */
	var Requests = class {
		resource = GetCurrentResourceName();
		waiting = /* @__PURE__ */ new Map();
		hovers = /* @__PURE__ */ new Map();
		nextId = 0;
		constructor() {
			const answer = (owner, id, value) => {
				if (owner !== this.resource || typeof id !== "number") return;
				this.waiting.get(id)?.(value);
				this.waiting.delete(id);
				this.hovers.delete(id);
			};
			on(MENU_EVENTS.menuHover, (owner, id, item) => {
				if (owner === this.resource && typeof id === "number" && typeof item === "string") this.hovers.get(id)?.(item);
			});
			on(MENU_EVENTS.menuResult, answer);
			on(MENU_EVENTS.inputResult, answer);
		}
		ask(open, read, onHover) {
			const id = ++this.nextId;
			this.waiting.set(id, read);
			if (onHover) this.hovers.set(id, onHover);
			open(id);
		}
	};
	const requests = new Requests();

// ../../../packages/lib/src/client/inventory.ts
	const core = resourceExport(CORE.resource);

// ../../../packages/lib/src/client/vehicleProps.ts
	const MOD_TYPES = Array.from({ length: 50 }, (_, i) => i);
	const TOGGLE_MODS = [
		17,
		18,
		19,
		20,
		21,
		22
	];
	/** Applies stored properties (only to a vehicle this client controls; others get them through the network). */
	function setVehicleProps(vehicle, props) {
		SetVehicleModKit(vehicle, 0);
		SetVehicleNumberPlateText(vehicle, props.plate);
		SetVehicleNumberPlateTextIndex(vehicle, props.plateIndex);
		SetVehicleColours(vehicle, props.colors[0], props.colors[1]);
		SetVehicleExtraColours(vehicle, props.extraColors[0], props.extraColors[1]);
		if (props.customPrimary) SetVehicleCustomPrimaryColour(vehicle, ...props.customPrimary);
		if (props.customSecondary) SetVehicleCustomSecondaryColour(vehicle, ...props.customSecondary);
		SetVehicleWheelType(vehicle, props.wheelType);
		SetVehicleWindowTint(vehicle, props.windowTint);
		for (const [type, index] of Object.entries(props.mods)) {
			const t = Number(type);
			if (TOGGLE_MODS.includes(t)) ToggleVehicleMod(vehicle, t, index === 1);
			else SetVehicleMod(vehicle, t, index, false);
		}
		SetVehicleLivery(vehicle, props.livery);
		SetVehicleXenonLightsColor(vehicle, props.xenonColor);
		props.neon.forEach((on, i) => SetVehicleNeonLightEnabled(vehicle, i, on));
		SetVehicleNeonLightsColour(vehicle, ...props.neonColor);
		SetVehicleTyreSmokeColor(vehicle, ...props.tyreSmoke);
		for (const [id, on] of Object.entries(props.extras)) SetVehicleExtra(vehicle, Number(id), !on);
		SetVehicleDirtLevel(vehicle, props.dirt);
		SetVehicleEngineHealth(vehicle, props.engineHealth);
		SetVehicleBodyHealth(vehicle, props.bodyHealth);
	}

// ../../../packages/lib/src/client/keybind.ts
	const resource = GetCurrentResourceName();

// resource/client/index.ts
/**
	* Owned vehicles carry their look in a state bag; the client that owns the entity applies it (the network copies it
	* to everyone else). The bag can arrive before the entity streams in, so this waits for it.
	*/
	AddStateBagChangeHandler(VEHICLE_BAGS.props, "", (bagName, _key, value) => {
		const props = toVehicleProps(value);
		if (!props) return;
		waitFor(() => {
			const entity = GetEntityFromStateBagName(bagName);
			return entity && DoesEntityExist(entity) ? entity : void 0;
		}, 5e3).then((entity) => {
			if (NetworkGetEntityOwner(entity) === PlayerId()) setVehicleProps(entity, props);
		}).catch(() => void 0);
	});

})();
}catch(e){globalThis.__aicoreReportError&&globalThis.__aicoreReportError("load: "+(e&&e.stack||e));throw e}
