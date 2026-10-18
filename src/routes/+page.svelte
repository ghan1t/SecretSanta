<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let recipient = $state<string | null>(null);
	let loading = $state(false);
	let message = $state('');
	let pending: AbortController | null = null;
	let version = 0;

	function hide() {
		version++;
		pending?.abort();
		pending = null;
		recipient = null;
		loading = false;
		message = '';
	}
	beforeNavigate(hide);
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
<svelte:window onpagehide={hide} onpageshow={hide} />

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
		{#if data.user}<form method="POST" action="/logout" data-sveltekit-reload onsubmit={hide}><button type="submit" class="logout">Sign out <span aria-hidden="true">↗</span></button></form>{:else}<span class="family-label">family edition</span>{/if}
	</header>

	<main>
		<section class="secret-card" class:is-revealed={recipient !== null} aria-label="Your Secret Santa">
			<div class="card-topline"><span>{data.event?.year ?? 'JUST FOR YOU'}</span><span class="postage-mark" aria-hidden="true">{@render snowIcon()}{@render treeIcon()}{@render giftIcon()}</span><span>SECRET SANTA</span></div>
			<div class="card-content" aria-live="polite" aria-busy={loading}>
				{#if data.state === 'ready' && data.user}
					{#if recipient}
						<p class="eyebrow">THE SECRET IS OUT</p>
						<h1>Your person is…</h1>
						<div class="recipient">
							<span class="reveal-spark reveal-spark-one" aria-hidden="true">{@render snowIcon()}</span><span class="reveal-spark reveal-spark-two" aria-hidden="true">{@render treeIcon()}</span><span class="reveal-spark reveal-spark-three" aria-hidden="true">♡</span>
							<span class="recipient-label">lucky them!</span>
							<strong>{recipient}</strong>
							<svg class="name-underline" viewBox="0 0 200 15" aria-hidden="true"><path d="M4 9Q85 0 195 7M29 13Q106 5 171 11" /></svg>
						</div>
						<p class="card-copy">Let the secret scheming begin.</p>
						<button type="button" class="primary" onclick={hide}>Hide my person <span aria-hidden="true">♡</span></button>
						<p class="tiny-note">Your lips are sealed. Right?</p>
					{:else}
						<p class="eyebrow">A LITTLE SOMETHING FOR YOU</p>
						<h1>Psst, {data.user.name}<span class="heading-star" aria-hidden="true">✧</span></h1>
						<p class="card-copy">Your Christmas person is waiting.</p>
						<div class="letter-scene" aria-hidden="true">
							<span class="scene-spark spark-left">{@render snowIcon()}</span><span class="scene-spark spark-right">{@render treeIcon()}</span><span class="scene-dot">•</span>
							<svg class="letter-friend" viewBox="0 0 260 210" fill="none">
								<path d="M98 167l-7 21-13-1m83-20 8 19 13-3" stroke="#2e4e40" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
								<g class="envelope-body">
									<rect x="46" y="55" width="169" height="115" rx="9" fill="#c9d9bd" stroke="#2e4e40" stroke-width="2.5" />
									<path d="m48 162 64-52m101 52-65-52" stroke="#96ae8e" stroke-width="2" />
									<path d="m49 59 72 57c5 4 11 4 16 0l75-57" fill="#e0e9d3" stroke="#2e4e40" stroke-width="2.5" stroke-linejoin="round" />
									<path d="M116 135v5m27-5v5" stroke="#2e4e40" stroke-width="3.5" stroke-linecap="round" />
									<path d="M125 146q6 7 12 0" stroke="#2e4e40" stroke-width="2.5" stroke-linecap="round" />
									<ellipse cx="107" cy="145" rx="6" ry="3" fill="#eaa3a5" /><ellipse cx="153" cy="145" rx="6" ry="3" fill="#eaa3a5" />
									<path d="m128 100-7-7c-9-9 4-18 9-8 6-10 18-1 9 8l-8 7Z" fill="#b65459" />
								</g>
								<g transform="rotate(12 181 49)">
									<path d="M150 52q3-35 33-32-12 8 10 32Z" fill="#b65459" stroke="#8d4144" stroke-width="1.5" />
									<rect x="145" y="47" width="54" height="12" rx="6" fill="#fffaf0" stroke="#2e4e40" stroke-width="1.5" />
									<circle cx="184" cy="21" r="8" fill="#fffaf0" stroke="#2e4e40" stroke-width="1.5" />
								</g>
								<path d="m42 108-13-7-8 5m199 1 13-11 8 3" stroke="#2e4e40" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
							<span class="letter-caption">a little North Pole post</span>
						</div>
						<button type="button" class="primary" onclick={reveal} disabled={loading}>{loading ? 'A little drumroll…' : 'Reveal my person'} <span aria-hidden="true">✧</span></button>
						<p class="tiny-note">For your eyes only.</p>
					{/if}
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
