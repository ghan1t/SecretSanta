<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let recipient = $state<string | null>(null);
	let loading = $state(false);
	let message = $state('');
	let pending: AbortController | null = null;
	let version = 0;
	let unfold = $state(0);
	let animationFrame: number | undefined;

	function smooth(value: number) {
		const clamped = Math.max(0, Math.min(1, value));
		return clamped * clamped * (3 - 2 * clamped);
	}
	const topFold = $derived(smooth(unfold / .62));
	const leftFold = $derived(smooth((unfold - .16) / .7));
	const rightFold = $derived(smooth((unfold - .22) / .7));
	const bottomFold = $derived(smooth((unfold - .32) / .68));
	const letterLift = $derived(smooth((unfold - .36) / .64));
	const nameOpacity = $derived(smooth((unfold - .44) / .36));
	const nameSize = $derived(Math.max(20, Math.min(56, 360 / Math.max(1, recipient?.length ?? 1))));

	function animateEnvelope(target: number) {
		if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
		animationFrame = undefined;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { unfold = target; return; }
		const from = unfold;
		const start = performance.now();
		const duration = Math.max(1, 1400 * Math.abs(target - from));
		function frame(now: number) {
			const elapsed = Math.min(1, (now - start) / duration);
			unfold = from + (target - from) * (.5 - Math.cos(elapsed * Math.PI) / 2);
			animationFrame = elapsed < 1 ? requestAnimationFrame(frame) : undefined;
		}
		animationFrame = requestAnimationFrame(frame);
	}
	function reset() {
		hide(true);
	}
	onDestroy(() => {
		if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
	});

	function hide(immediately = false) {
		version++;
		pending?.abort();
		pending = null;
		recipient = null;
		loading = false;
		message = '';
		if (immediately) {
			if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
			animationFrame = undefined;
			unfold = 0;
		} else animateEnvelope(0);
	}
	beforeNavigate(reset);
	async function reveal() {
		if (loading) return;
		loading = true;
		message = '';
		const requestVersion = ++version;
		pending = new AbortController();
		try {
			const response = await fetch('/api/recipient', { method: 'POST', signal: pending.signal });
			const result = await response.json();
			if (requestVersion !== version) return;
			if (!response.ok) { message = result.error ?? 'Please try again.'; return; }
			if (typeof result.recipient?.name !== 'string') throw new Error('Invalid response');
			recipient = result.recipient.name;
			animateEnvelope(1);
		} catch (error) {
			if (requestVersion === version && !(error instanceof DOMException && error.name === 'AbortError')) message = 'We couldn’t open your assignment. Please try again.';
		} finally {
			if (requestVersion === version) { loading = false; pending = null; }
		}
	}
</script>

<svelte:head>
	<title>Family Secret Santa</title>
	<meta name="description" content="A little mystery for our family gift exchange." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>
<svelte:window onpagehide={reset} onpageshow={reset} />

{#snippet treeIcon()}
	<svg viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="m12 2 7 9h-4l7 9H2l7-9H5l7-9Z" fill="currentColor" fill-opacity=".15" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M12 20v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /><circle cx="12" cy="10" r="1" fill="#b65459" /><circle cx="8" cy="16" r="1" fill="#b58a41" /><circle cx="16" cy="17" r="1" fill="#b65459" /></svg>
{/snippet}
{#snippet snowIcon()}
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2v20M3.34 7l17.32 10M3.34 17 20.66 7M9 4l3 3 3-3M9 20l3-3 3 3M3.5 10.5l4.1-1.1-1.1-4.1m11 13.3-1.1-4.1 4.1-1.1m-17 0 4.1 1.1-1.1 4.1m11-13.3-1.1 4.1 4.1 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
{/snippet}
{#snippet giftIcon()}
	<svg viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M4 12h16v12H4zM2 8h20v5H2zM12 8v16" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /><path d="M12 8C3 8 4 0 8 2c2 1 4 6 4 6Zm0 0c9 0 8-8 4-6-2 1-4 6-4 6Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
{/snippet}

<div class="page-shell">
	<header class="app-header">
		<a class="wordmark" href="/" aria-label="Family Secret Santa home"><span class="brand-star" aria-hidden="true">{@render treeIcon()}</span> secret santa<span class="brand-dot" aria-hidden="true">.</span></a>
		{#if data.user}<form method="POST" action="/logout" data-sveltekit-reload onsubmit={reset}><button type="submit" class="logout">Sign out <span aria-hidden="true">↗</span></button></form>{:else}<span class="family-label">family edition</span>{/if}
	</header>

	<main>
		<section class="secret-card" class:is-revealed={recipient !== null} aria-label="Your Secret Santa">
			<div class="card-topline"><span>{data.event?.year ?? 'JUST FOR YOU'}</span><span class="postage-mark" aria-hidden="true">{@render snowIcon()}{@render treeIcon()}{@render giftIcon()}</span><span>SECRET SANTA</span></div>
			<div class="card-content" aria-live="polite" aria-busy={loading}>
				{#if data.state === 'ready' && data.user}
					<div class="reveal-heading">
						<p class="eyebrow">{recipient ? 'THE SECRET IS OUT' : 'A LITTLE SOMETHING FOR YOU'}</p>
						<h1>{#if recipient}Your person is…{:else}Psst, {data.user.name}<span class="heading-star" aria-hidden="true">✧</span>{/if}</h1>
						<p class="card-copy">{recipient ? 'Let the secret scheming begin.' : 'Your Christmas person is waiting.'}</p>
					</div>
					<div class="envelope-scene" class:is-open={recipient !== null}>
						<span class="scene-spark spark-left" aria-hidden="true">{@render snowIcon()}</span>
						<span class="scene-spark spark-right" aria-hidden="true">{@render treeIcon()}</span>
						<div class="envelope-motion">
						<svg class="letter-friend" style:transform={`scale(${1.15 - letterLift * .3})`} viewBox="0 0 320 300" fill="none" aria-hidden="true">
							<!-- Envelope and letter share one persistent sway animation. -->
							<g class="envelope-limbs" opacity={1 - smooth(unfold * 2)} aria-hidden="true">
								<path d="m126 197-8 23-14-1m84-22 9 22 13-3M71 149l-13-7-8 5m199 1 13-11 8 3" stroke="#2e4e40" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
							</g>
							<rect x="74" y="98" width="172" height="104" rx="9" fill="#e5ecd8" stroke="#52734f" stroke-width="1.7" />
							<rect x="82" y="106" width="156" height="88" rx="2" stroke="#b8c8a7" stroke-dasharray="2 4" />

							<!-- Tips pass through each crease and unfold to the outside. -->
							<path class="envelope-flap flap-left" d={`M83 98Q74 98 74 107V193Q74 202 83 202L${162 - leftFold * 154} 150Z`} fill={leftFold < .5 ? '#c9d9bd' : '#dce6cb'} stroke="#52734f" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true" />
							<path class="envelope-flap flap-right" d={`M237 98Q246 98 246 107V193Q246 202 237 202L${158 + rightFold * 154} 150Z`} fill={rightFold < .5 ? '#c3d5b6' : '#dce6cb'} stroke="#52734f" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true" />
							<path class="envelope-flap flap-bottom" d={`M74 193Q74 202 83 202H237Q246 202 246 193L160 ${137 + bottomFold * 126}Z`} fill={bottomFold < .5 ? '#c9d9bd' : '#e0e9d0'} stroke="#52734f" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true" />
							<g transform={`translate(0 ${bottomFold * 64})`} opacity={1 - smooth(bottomFold * 3)} aria-hidden="true">
								<path d="M147 173v5m26-5v5" stroke="#2e4e40" stroke-width="3.5" stroke-linecap="round" />
								<path d="M155 185q6 7 12 0" stroke="#2e4e40" stroke-width="2.5" stroke-linecap="round" />
								<ellipse cx="138" cy="184" rx="6" ry="3" fill="#eaa3a5" /><ellipse cx="182" cy="184" rx="6" ry="3" fill="#eaa3a5" />
							</g>
							<path class="envelope-flap flap-top" d={`M74 107Q74 98 83 98H237Q246 98 246 107L160 ${163 - topFold * 126}Z`} fill={topFold < .5 ? '#e0e9d3' : '#e5ecd8'} stroke="#52734f" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true" />
							<g transform={`translate(0 ${-topFold * 94})`} opacity={1 - smooth(topFold * 2)} aria-hidden="true"><path d="m159 143-7-7c-9-9 4-18 9-8 6-10 18-1 9 8l-8 7Z" fill="#b65459" /></g>
							<g transform={`translate(${-topFold * 18} ${-topFold * 33}) rotate(12 218 91)`} aria-hidden="true">
								<path d="M190 94q3-35 33-32-12 8 10 32Z" fill="#b65459" stroke="#8d4144" stroke-width="1.5" />
								<rect x="185" y="89" width="54" height="12" rx="6" fill="#fffaf0" stroke="#2e4e40" stroke-width="1.5" />
								<circle cx="224" cy="63" r="8" fill="#fffaf0" stroke="#2e4e40" stroke-width="1.5" />
							</g>
						</svg>
						<div class="letter-paper" style:transform={`translate(-50%, -50%) translate3d(0, ${28 - letterLift * 58}px, ${-60 + letterLift * 110}px) rotateX(${(1 - letterLift) * 55}deg) scale(${.5 + letterLift * .5})`} style:opacity={nameOpacity} aria-hidden={recipient === null || nameOpacity < .99}>
							<div class="recipient" style:--name-size={`${nameSize}px`}>
								<span class="paper-spark" aria-hidden="true">✧</span>
								<span class="recipient-label">you’re gifting to</span>
								<strong>{recipient ?? ''}</strong>
								<svg class="name-underline" viewBox="0 0 150 12" aria-hidden="true"><path d="M4 6Q68 0 145 5M25 10Q82 4 127 9" /></svg>
								<span class="paper-signoff">with a little Christmas magic ♡</span>
							</div>
						</div>
						</div>
						<span class="letter-caption" aria-hidden="true">{recipient ? 'a secret, unfolded' : 'a little North Pole post'}</span>
					</div>
					<button type="button" class="primary" onclick={() => recipient ? hide() : reveal()} disabled={loading}>
						{loading ? 'A little drumroll…' : recipient ? 'Hide my person' : 'Reveal my person'} <span aria-hidden="true">{recipient ? '♡' : '✧'}</span>
					</button>
					<p class="tiny-note">{recipient ? 'Your lips are sealed. Right?' : 'For your eyes only.'}</p>
				{:else}
					<div class="welcome-doodle" aria-hidden="true">{data.state === 'unknown' ? '?' : data.state === 'unavailable' ? '☁' : '♡'}<span>✧</span></div>
					{#if data.state === 'unknown'}
						<p class="eyebrow">A CASE OF MISTAKEN IDENTITY</p><h1>Wrong party?</h1>
						<p class="card-copy">Try your other Google account,<br />or give the organizer a nudge.</p>
						<form method="POST" action="/logout" data-sveltekit-reload><button class="primary" type="submit">Try another account <span aria-hidden="true">↗</span></button></form>
					{:else if data.state === 'unavailable'}
						<p class="eyebrow">ONE SMALL PAUSE</p><h1>A tiny hiccup.</h1>
						<p class="card-copy">We couldn’t open the door.<br />Try again or ask the organizer.</p>
						<a class="primary button-link" href="/" data-sveltekit-reload>Try again <span aria-hidden="true">↻</span></a>
					{:else}
						<p class="eyebrow">YOU’RE ON THE NICE LIST</p><h1>Psst. Come in.</h1>
						<p class="card-copy">One name. One little secret.</p>
						{#if data.localMode}<p class="local-help">Pick a test person in the playground below.</p>{:else}<p class="local-help">Use your family’s private app link to sign in with Google.</p>{/if}
					{/if}
				{/if}
				{#if message}<p class="error" role="alert">{message}</p>{/if}
			</div>
			<div class="card-footer"><span aria-hidden="true">{@render treeIcon()}</span> a little Christmas conspiracy <span aria-hidden="true">{@render treeIcon()}</span></div>
		</section>
		<p class="under-card" aria-hidden="true">merry little secrets <span>♡</span></p>
	</main>

	{#if data.localMode}
		<details class="development-toolbar">
			<summary>Dev playground <span>· fictional people</span></summary>
			<form method="POST" action="/dev/identity" data-sveltekit-reload>
				<label for="development-identity">Test as</label>
				<select id="development-identity" name="identity">
					<option value="">Signed out</option>
					{#each data.developmentPeople as person}<option value={person.id} selected={data.user?.id === person.id}>{person.name}</option>{/each}
					<option value="unknown" selected={data.state === 'unknown'}>Unknown Google account</option>
				</select>
				<button type="submit">Use identity</button>
			</form>
			<p>Local development only. Fictional identities and a saved example draw.</p>
		</details>
	{/if}
</div>
