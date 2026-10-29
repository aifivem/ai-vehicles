/*aicore-client-errors*/(function(){var n=GetCurrentResourceName(),s={},c=0;var r=function(t){t=String(t).replace(/\^\d/g,"");var k=t.slice(0,300);if(s[k]||c>=20)return;s[k]=1;c++;try{TriggerServerEvent("ai-core:clientError",n,t.slice(0,4000))}catch(e){}};globalThis.__aicoreReportError=r;var l=console.log;console.log=function(){var a=arguments[0];if(typeof a==="string"&&a.indexOf("SCRIPT ERROR")!==-1)r(a);return l.apply(console,arguments)}})();
try{
(function() {

// ../../../packages/lib/src/fivem/callbackNames.ts
/**
	* Callback wire format, the same on both sides:
	*   request  `aicore:cb:<name>`              (callerResource, id, ...args)
	*   response `aicore:cbr:<callerResource>`   (id, ok, result)
	* The response goes only to the resource that asked, so two resources never see each other's replies.
	*/
	const requestEvent = (name) => `aicore:cb:${name}`;
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
	const log$2 = createLogger(GetCurrentResourceName());
	/**
	* Whether the net event being handled came from the server (read it before the first `await`). On a client only
	* events from the server carry a source (65535 in the docs); a local emit by any resource carries none.
	*/
	const fromServer = () => Boolean(globalThis.source);

// ../../../packages/lib/src/client/callback.ts
	const resource = GetCurrentResourceName();
	const log$1 = createLogger(resource);
	const pending = /* @__PURE__ */ new Map();
	onNet(responseEvent(resource), (id, ok, result) => {
		if (!fromServer()) return;
		const entry = typeof id === "number" ? pending.get(id) : void 0;
		if (!entry) return;
		pending.delete(id);
		clearTimeout(entry.timer);
		if (ok === true) entry.resolve(result);
		else entry.reject(/* @__PURE__ */ new Error("server callback failed"));
	});
	/** Answers the server's `triggerClientCallback(name, source, ...)`. Arguments are unknown: parse before use. */
	function onServerCallback(name, handler) {
		onNet(requestEvent(name), async (caller, id, ...args) => {
			if (!fromServer() || typeof caller !== "string" || typeof id !== "number") return;
			try {
				const result = await handler(...args);
				emitNet(responseEvent(caller), id, true, result ?? null);
			} catch (error) {
				log$1.error(`callback ${name} failed`, error);
				emitNet(responseEvent(caller), id, false, null);
			}
		});
	}

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
		clientPlayerLoadedEvent: "ai-core:client:playerLoaded",
		clientPlayerUnloadedEvent: "ai-core:client:playerUnloaded",
		/** (charId: number, url: string) a portrait image of a character on the character screen (e.g. `https://nui-img/<txd>/<txd>`). */
		clientCharacterPortraitEvent: "ai-core:client:characterPortrait",
		/** (resource: string, id: string) the interaction key was pressed while that resource's prompt was on top. */
		clientPromptPressedEvent: "ai-core:client:promptPressed",
		/** (key: keyof PlayerCache, value) a cached value of the local player changed (one watcher in ai-core for every resource). */
		clientCacheEvent: "ai-core:client:cache",
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

// ../../../packages/lib/src/client/cache.ts
/** The unarmed "weapon" hash: cached as `false`. */
	const UNARMED = GetHashKey("WEAPON_UNARMED") | 0;
	/** The vehicle, seat and weapon of a ped right now (also ai-core's watcher). */
	function readPlayerState(ped) {
		const vehicle = GetVehiclePedIsIn(ped, false);
		let seat = false;
		if (vehicle) for (let i = -1; i < GetVehicleMaxNumberOfPassengers(vehicle); i++) {
			if (GetPedInVehicleSeat(vehicle, i) !== ped) continue;
			seat = i;
			break;
		}
		const weapon = GetSelectedPedWeapon(ped) | 0;
		return {
			vehicle: vehicle || false,
			seat,
			weapon: weapon === UNARMED ? false : weapon
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
	const log = createLogger(GetCurrentResourceName());

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

// resource/common/vehicles.ts
	const EVENTS = { 
	/** Server -> client callback: (model) -> vehicle type for CreateVehicleServerSetter. */
vehicleType: "ai-vehicles:vehicleType" };
	/** GTA vehicle class -> the type CreateVehicleServerSetter wants. */
	function typeOfClass(vehicleClass) {
		switch (vehicleClass) {
			case 8:
			case 13: return "bike";
			case 14: return "boat";
			case 15: return "heli";
			case 16: return "plane";
			case 21: return "train";
			default: return "automobile";
		}
	}

// resource/client/index.ts
/** The server asks a client which spawn type a model is (CreateVehicleServerSetter needs it). */
	onServerCallback(EVENTS.vehicleType, (model) => typeof model === "string" ? typeOfClass(GetVehicleClassFromName(model)) : "automobile");
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
