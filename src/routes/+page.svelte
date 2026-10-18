<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale, setLocale } from '#lib/paraglide/runtime.js';
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
			if (!response.ok) { message = result.error ?? m.error_retry(); return; }
			if (typeof result.recipient?.name !== 'string') throw new Error('Invalid response');
			recipient = result.recipient.name;
			animateEnvelope(1);
		} catch (error) {
			if (requestVersion === version && !(error instanceof DOMException && error.name === 'AbortError')) message = m.error_open();
		} finally {
			if (requestVersion === version) { loading = false; pending = null; }
		}
	}
</script>

<svelte:head>
	<title>{m.page_title()}</title>
	<meta name="description" content={m.page_description()} />
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
		<a class="wordmark" href="/" aria-label={m.home_label()}><span class="brand-star" aria-hidden="true">{@render treeIcon()}</span> {m.brand()}<span class="brand-dot" aria-hidden="true">.</span></a>
		<div class="header-actions">
			{#if data.user}<form method="POST" action="/logout" data-sveltekit-reload onsubmit={reset}><button type="submit" class="logout">{m.sign_out()} <span aria-hidden="true">↗</span></button></form>{:else}<span class="family-label">{m.family_edition()}</span>{/if}
			<button type="button" class="language-toggle" aria-label={m.switch_language({ language: getLocale() === 'en' ? 'Latviešu' : 'English' })} title={getLocale() === 'en' ? 'Latviešu' : 'English'} onclick={() => { reset(); setLocale(getLocale() === 'en' ? 'lv' : 'en'); }}>
				<span aria-hidden="true">{getLocale() === 'en' ? '🇱🇻' : '🇬🇧'}</span>
			</button>
		</div>
	</header>

	<main>
		<section class="secret-card" class:is-revealed={recipient !== null} aria-label={m.card_label()}>
			<div class="card-topline"><span>{data.event?.year ?? m.just_for_you()}</span><span class="postage-mark" aria-hidden="true">{@render snowIcon()}{@render treeIcon()}{@render giftIcon()}</span><span>{m.card_stamp()}</span></div>
			<div class="card-content" aria-live="polite" aria-busy={loading}>
				{#if data.state === 'ready' && data.user}
					<div class="reveal-heading">
						<p class="eyebrow">{recipient ? m.eyebrow_revealed() : m.eyebrow_waiting()}</p>
						<h1>{#if recipient}{m.revealed_heading()}{:else}{m.greeting({ name: data.user.name })}<span class="heading-star" aria-hidden="true">✧</span>{/if}</h1>
						<p class="card-copy">{recipient ? m.revealed_copy() : m.waiting_copy()}</p>
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
								<span class="recipient-label">{m.recipient_label()}</span>
								<strong>{recipient ?? ''}</strong>
								<svg class="name-underline" viewBox="0 0 150 12" aria-hidden="true"><path d="M4 6Q68 0 145 5M25 10Q82 4 127 9" /></svg>
								<span class="paper-signoff">{m.paper_signoff()}</span>
							</div>
						</div>
						</div>
						<span class="letter-caption" aria-hidden="true">{recipient ? m.caption_open() : m.caption_closed()}</span>
					</div>
					<button type="button" class="primary" onclick={() => recipient ? hide() : reveal()} disabled={loading}>
						{loading ? m.reveal_loading() : recipient ? m.hide_person() : m.reveal_person()} <span aria-hidden="true">{recipient ? '♡' : '✧'}</span>
					</button>
					<p class="tiny-note">{recipient ? m.note_revealed() : m.note_waiting()}</p>
				{:else}
					<div class="welcome-doodle" aria-hidden="true">{data.state === 'unknown' ? '?' : data.state === 'unavailable' ? '☁' : '♡'}<span>✧</span></div>
					{#if data.state === 'unknown'}
						<p class="eyebrow">{m.unknown_eyebrow()}</p><h1>{m.unknown_heading()}</h1>
						<p class="card-copy">{m.unknown_copy()}</p>
						<form method="POST" action="/logout" data-sveltekit-reload><button class="primary" type="submit">{m.try_account()} <span aria-hidden="true">↗</span></button></form>
					{:else if data.state === 'unavailable'}
						<p class="eyebrow">{m.unavailable_eyebrow()}</p><h1>{m.unavailable_heading()}</h1>
						<p class="card-copy">{m.unavailable_copy()}</p>
						<a class="primary button-link" href="/" data-sveltekit-reload>{m.retry()} <span aria-hidden="true">↻</span></a>
					{:else}
						<p class="eyebrow">{m.welcome_eyebrow()}</p><h1>{m.welcome_heading()}</h1>
						<p class="card-copy">{m.welcome_copy()}</p>
						{#if data.localMode}<p class="local-help">{m.local_help()}</p>{:else}<p class="local-help">{m.login_help()}</p>{/if}
					{/if}
				{/if}
				{#if message}<p class="error" role="alert">{message}</p>{/if}
			</div>
			<div class="card-footer"><span aria-hidden="true">{@render treeIcon()}</span> {m.footer()} <span aria-hidden="true">{@render treeIcon()}</span></div>
		</section>
		<p class="under-card" aria-hidden="true">{m.under_card()} <span>♡</span></p>
	</main>

	{#if data.localMode}
		<details class="development-toolbar">
			<summary>{m.dev_summary()} <span>· {data.developmentSource === 'fictional' ? m.dev_fictional() : data.developmentSource === 'private' ? m.dev_private() : m.dev_unconfigured()}</span></summary>
			<form method="POST" action="/dev/identity" data-sveltekit-reload>
				<label for="development-identity">{m.dev_test_as()}</label>
				<select id="development-identity" name="identity">
					<option value="">{m.dev_signed_out()}</option>
					{#each data.developmentPeople as person}<option value={person.id} selected={data.user?.id === person.id}>{person.name}</option>{/each}
					<option value="unknown" selected={data.state === 'unknown'}>{m.dev_unknown()}</option>
				</select>
				<button type="submit">{m.dev_use()}</button>
			</form>
			<p>{data.developmentSource === 'fictional' ? m.dev_note() : m.dev_private_note()}</p>
		</details>
	{/if}
</div>
