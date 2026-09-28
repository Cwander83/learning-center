# The Complete Guide: Learning Angular from Scratch in 2026

> Angular is a full framework, not a library — it hands you components, routing, forms, data fetching, and a build tool that already agree with each other. This is the beginner's tour: what each piece is, what it does, and how it connects to the next piece.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

If you have used React or Vue, the first thing to understand about Angular is that it is bigger. React gives you a way to build a UI and then leaves you to choose a router, a form approach, a data-fetching layer, and a build tool. Angular ships all of those already wired together, plus a command-line tool that generates the files. That is the whole trade: **less choosing, more framework.**

The second thing to understand is that Angular has changed a lot recently, and a lot of advice online is out of date. If a tutorial talks about `NgModules`, `*ngIf`, `@Input()` decorators, or Zone.js as something you should reach for, it is describing the Angular of several years ago. As of Angular 22 (June 2026), the defaults are **standalone components**, **signals** for state, **built-in control flow** in templates, and **no Zone.js at all**. This guide teaches the 2026 shape, and points out the old names where you will still see them.

Here is the mental model, and everything else in this guide is a detail hanging off it:

```
   AN ANGULAR APP IS A TREE OF COMPONENTS

                      AppComponent            ← the root, bootstrapped in main.ts
                      ┌─────┴─────┐
                 Header        RouterOutlet     ← where the Router shows the page
                                  │
                    ┌─────────────┼─────────────┐
                ProductList   CartPage      CheckoutPage   ← one component per page
                    │
               ProductCard    ← a child component, reused in a loop

   AND FIVE SERVICES HANGING OFF THE WHOLE TREE

   ┌───────────────────────────────────────────────────────────────┐
   │  Router   →  decides which component shows for the URL        │
   │  Forms    →  tracks typed-in values and validation            │
   │  HTTP     →  talks to your server                             │
   │  Signals  →  holds state and tells Angular what changed       │
   │  DI       →  the system that delivers all of the above        │
   └───────────────────────────────────────────────────────────────┘

   THE TOOLCHAIN AROUND IT

   ng new     →  create a project        ng serve  →  run it locally
   ng generate →  create a file          ng build  →  make the deployable output
   ng test    →  run your tests          ng update →  move to a newer version
```

The one rule that ties it together: **a component owns one piece of screen, a service owns one piece of logic, and dependency injection is how the component gets the service.** Get comfortable with that sentence and the framework stops feeling large.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Component** | A custom HTML tag with behaviour | The unit you build the screen out of |
| **Template** | The component's HTML | Where data shows up and clicks are handled |
| **Directive** | A behaviour you attach to an element | Adds functionality without a new component |
| **Pipe** | A function in the template | Formats a value for display, like a date |
| **Service** | A shared helper class | One place for logic many components need |
| **Dependency injection** | A request desk, not a factory | You ask for a service; Angular supplies it |
| **Signal** | A value that announces its own changes | How Angular knows what to re-render |
| **Router** | The app's traffic controller | Maps URLs to components |
| **Router outlet** | A placeholder the router fills in | Where the current page renders |
| **Form** | A structured way to collect input | Tracks values, validity, and errors together |
| **`httpResource`** | A live connection to a URL | Fetches data and reports loading and errors |
| **CLI** | The project's control panel | Creates, runs, builds, and upgrades everything |
| **Standalone component** | Self-contained, no module wrapper | The modern default; imports what it needs |
| **Zoneless** | No background watcher | Change detection is driven by signals, not events |

> **The one-sentence version:** Angular is a connected set of pieces — components draw the screen, signals hold the state, services hold the logic, DI connects them, and the router decides which screen you are on — and once you can draw that wiring diagram from memory, the rest is practice.

---

## The 60-Second Version (TL;DR)

1. **Angular is a framework**, so routing, forms, HTTP, state, and the build tool are included and designed to work together. You are not assembling a stack.
2. **The current major version is Angular 22**, released 3 June 2026. A major lands roughly once a year, so v23 is expected around mid-2027.
3. **Components are the building block.** A component is a TypeScript class plus an HTML template plus a selector, joined by one `@Component` decorator.
4. **Signals are how data flows.** `signal()` holds a value, `computed()` derives one, `effect()` reacts to one. When a template reads a signal, Angular updates that part of the page automatically.
5. **Services hold shared logic**, and `inject()` is how a component asks for one. In Angular 22 there is now a short `@Service()` decorator alongside the classic `@Injectable({ providedIn: 'root' })`.
6. **Templates use built-in blocks:** `@if`, `@for`, `@switch`, and `@defer`. The old `*ngIf` and `*ngFor` are legacy.
7. **The router maps URLs to components**, with `<router-outlet>` marking where the page appears. Big pages can load on demand with `loadComponent`.
8. **Angular 22 has Signal Forms**, a new stable way to build forms on signals. Reactive forms are still fine and still supported.
9. **`httpResource` fetches data** and gives you loading, error, and value as signals. It graduated to stable in Angular 22.
10. **The defaults are already fast:** no Zone.js, `OnPush` change detection by default, server-side rendering available from the CLI, and Vitest as the test runner.

If you read nothing else, read **Part 1 (the mental model)** and **Part 3 (components)**.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| Node.js 22.22+, 24.13.1+, or 26+ | Angular 22 requires one of these | `node --version` |
| Basic HTML and CSS | Templates are HTML; styling is CSS | comfort |
| Basic TypeScript | Components and services are TS classes | `let`/`const`, types, classes |
| A terminal | The CLI is how you create and run everything | any shell |
| A code editor | VS Code plus the Angular Language Service is the common path | — |

> **You do not need to know TypeScript deeply to start.** You need classes, types, and functions. Decorators are the one Angular-flavoured idea, and they are explained the first time they appear in Part 3.

> **A note on versions.** Angular 22 pins TypeScript to `>=6.0.0 <6.1.0`, and older TypeScript versions are not supported. If a tutorial insists on TypeScript 5, it predates this version. Also note that Angular majors are supported for about 24 months — six months active plus LTS — which is why the version in a tutorial matters.

---

## Part 1 — The Mental Model: What Angular Is Made Of

Before any code, get the five pieces and their jobs straight. Every remaining part of this guide is one of these five, in more detail.

### 1.1 Components draw the screen

A **component** is a reusable piece of interface. It has three parts working together: a class (the behaviour), a template (the HTML), and a selector (the tag name you use elsewhere). Angular composes components into a tree, with one root component at the top.

Think of each component as a custom HTML element. You define `<app-product-card>`, and from then on you use it like any other tag.

### 1.2 Signals hold the state

A **signal** is a box holding a value that announces when the value changes. Angular watches which parts of a template read which signals, and updates only those parts when the value moves. This is how modern Angular knows what to re-render, and it is why the framework no longer needs to watch everything for you.

You will meet three: `signal()` for a value you change, `computed()` for a value derived from others, and `effect()` for running code when values change.

### 1.3 Services hold the logic

A **service** is a plain class for logic that is not about a single piece of screen — fetching data, keeping a shopping cart, formatting addresses. You make one so that several components can share the same behaviour instead of each re-implementing it.

### 1.4 Dependency injection connects them

**Dependency injection (DI)** is the system that delivers services to the components that ask for them. You do not construct a service yourself; you request it, and Angular hands you the instance.

The everyday tool here is the `inject()` function: `private cart = inject(CartService);`. One line, and the component has a working cart service.

### 1.5 The router decides the page

The **router** watches the browser URL and decides which component is the current page. When the URL changes, the router swaps in a different component in place of the `<router-outlet>` marker. This is what makes it a multi-page-feeling app while staying a single-page application.

```
   A REQUEST TO /products/42, END TO END

   URL changes to /products/42
        │
        ▼
   Router matches the route  ──  loadComponent() fetches that page's code
        │
        ▼
   ProductDetail component renders inside <router-outlet>
        │
        ▼
   Component reads a signal  ──  signal value comes from a service
        │
        ▼
   Service calls httpResource()  ──  GET /api/products/42
        │
        ▼
   Response arrives  ──  the signal updates  ──  the page updates
```

That diagram is the whole framework in six lines. The rest of this guide walks each step.

> **The old vocabulary, for when you meet it.** Older tutorials call the state layer "RxJS Observables", the component structure "NgModules", and the template conditionals `*ngIf`. All three still exist, and all three are no longer the recommended default. When you see them, translate: Observables → signals at the edge, NgModules → standalone components, `*ngIf` → `@if`.

---

## Part 2 — Your First App, and the Five CLI Commands You Will Live In

### 2.1 Install and create

```bash
# once, globally
npm install -g @angular/cli

# create a project, then run it
ng new my-app
cd my-app
ng serve --open
```

`ng new` asks a couple of questions — routing, and your stylesheet format — and then generates a working app. You can accept the defaults on every prompt. `ng serve --open` starts a development server on `http://localhost:4200`, watches your files, and reloads the browser as you save. There is no separate build step in development.

### 2.2 The five commands

| Command | What it does | When you use it |
|---|---|---|
| `ng new my-app` | Creates a workspace and a starter app | Once, at the start |
| `ng serve` | Runs it locally with live reload | All day, while building |
| `ng generate component cart` | Creates the files for a new piece | Whenever you add one |
| `ng build` | Produces the deployable output in `dist/` | Before you ship |
| `ng test` | Runs the unit tests | As you go, and in CI |

`ng generate` has short aliases for everything: `ng g c cart` makes a component, `ng g s cart` makes a service, `ng g guard auth` makes a route guard. This is how you will create most files — you rarely write the boilerplate by hand.

### 2.3 What got created

```
   my-app/
   ├── src/
   │   ├── app/
   │   │   ├── app.ts            ← the root component (Angular 22 naming)
   │   │   ├── app.html          ← its template
   │   │   └── app.config.ts     ← app-wide providers (router, HTTP, …)
   │   ├── main.ts               ← bootstrap: starts Angular
   │   ├── index.html            ← the single HTML page
   │   └── styles.css            ← global styles
   ├── angular.json              ← CLI and build configuration
   ├── package.json              ← scripts and dependencies
   └── tsconfig.json             ← TypeScript settings
```

Two files matter immediately. **`main.ts`** is where the app starts, and it names the root component. **`app.config.ts`** is where app-wide settings are registered — this is where you add the router, HTTP, and anything else that should exist once for the whole application.

> **Note the modern naming.** Newer Angular projects name the root files `app.ts` / `app.html` rather than `app.component.ts`. Both patterns are valid; the shorter one is the current CLI default. Do not let a difference in filenames confuse you — the structure is identical.

---

## Part 3 — Components: The Building Block

### 3.1 The anatomy

A component is a class with one decorator above it. The decorator is the glue that says "this class draws this template, under this tag name."

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',        // the tag you use elsewhere: <app-counter />
  templateUrl: './counter.html',  // the HTML, or use `template:` for inline
  styleUrl: './counter.css',      // styles scoped to this component
})
export class Counter {
  count = signal(0);              // state lives here

  increment() {
    this.count.update((n) => n + 1);
  }
}
```

```html
<!-- counter.html -->
<p>Count: {{ count() }}</p>
<button (click)="increment()">Add one</button>
```

Three things to notice, because they are the heart of Angular:

- **`{{ count() }}`** prints a value. You call the signal like a function to read it.
- **`(click)="increment()"`** listens for an event. Parentheses mean "listen".
- **`[someProp]="value"`** (not shown yet) would pass a value in. Square brackets mean "bind".

Those two symbols — `()` and `[]` — carry most of a template's meaning. You will use them constantly.

### 3.2 Showing a component inside another

Components are standalone by default in modern Angular, which means a component lists whatever it needs in its own `imports` array. To use `<app-counter>`, another component imports it:

```ts
import { Component } from '@angular/core';
import { Counter } from './counter';

@Component({
  selector: 'app-home',
  imports: [Counter],              // ← this is what makes <app-counter> available
  template: `
    <h1>Home</h1>
    <app-counter />
    <app-counter />
  `,
})
export class Home {}
```

Two `<app-counter />` tags, two independent counters. That is component reuse.

> **If a component does not render, check the `imports` array first.** Forgetting to import a component — or a directive, or a pipe — is the single most common beginner error in Angular, and the fix is always the same.

### 3.3 Passing data in: inputs

An **input** is data handed down from a parent to a child. In modern Angular you declare it with the `input()` function, which creates a signal.

```ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-product-card',
  template: `<h2>{{ name() }}</h2><p>{{ price() }}</p>`,
})
export class ProductCard {
  name = input.required<string>();   // must be provided
  price = input(0);                  // optional, with a default
}
```

The parent passes values with square brackets:

```html
<app-product-card [name]="product.name" [price]="product.price" />
```

`input.required<string>()` tells TypeScript that `name` will always exist, so you never have to handle "maybe undefined". It is a small thing that removes a whole class of bugs.

### 3.4 Sending data out: outputs

An **output** is an event sent up from a child to a parent — "the user clicked save", "the field changed". You declare one with `output()` and emit from it.

```ts
import { Component, output } from '@angular/core';

@Component({
  selector: 'app-save-button',
  template: `<button (click)="saved.emit(true)">Save</button>`,
})
export class SaveButton {
  saved = output<boolean>();
}
```

The parent listens with parentheses:

```html
<app-save-button (saved)="onSaved($event)" />
```

### 3.5 Two-way binding: `model()`

When a value should flow both ways — the child can both receive and update it — use `model()`. The parent binds with `[(value)]`, the "banana in a box" syntax you will see in every Angular tutorial.

```ts
export class NameField {
  value = model('');       // child declares it
}
```

```html
<app-name-field [(value)]="userName" />
```

Data goes down as an input and comes back up as an output, and `model()` writes both halves for you.

> **The old way, briefly.** You will see `@Input()` and `@Output()` decorators in older code, and they still work. The signal-based `input()`, `output()`, and `model()` functions are the current recommendation because they are typed, reactive, and need no setter/getter tricks. If you are learning now, learn the functions.

---

## Part 4 — Templates: Where HTML Meets Data

### 4.1 The binding symbols

| You write | Meaning | Example |
|---|---|---|
| `{{ value }}` | Print a value | `{{ user()?.name }}` |
| `[property]="expr"` | Pass data *in* to an element or component | `[disabled]="!form.valid()"` |
| `(event)="handler()"` | Listen for an event | `(click)="save()"` |
| `[(property)]="x"` | Two-way binding | `[(value)]="name"` |

### 4.2 Control flow: `@if`, `@for`, `@switch`

Modern Angular puts conditionals and loops in the template as blocks, starting with `@`. They read like a mix of JavaScript and HTML, and they replaced the old `*ngIf` and `*ngFor` directives.

```html
@if (user()) {
  <p>Welcome back, {{ user().name }}.</p>
} @else {
  <p>Please sign in.</p>
}
```

```html
@for (product of products(); track product.id) {
  <app-product-card [name]="product.name" [price]="product.price" />
} @empty {
  <p>No products yet.</p>
}
```

Two details worth remembering. The **`track`** expression tells Angular which value identifies each item; without it, Angular cannot reuse DOM nodes efficiently and will warn you. And **`@empty`** gives you a built-in "no items" state, which removes the usual extra `@if` around the list.

```html
@switch (status()) {
  @case ('loading') { <app-spinner /> }
  @case ('error')   { <p>Something went wrong.</p> }
  @default          { <app-content /> }
}
```

### 4.3 `@defer`: load part of the page later

`@defer` delays loading a section until it is actually needed — when it scrolls into view, when the browser is idle, or on a click. The code for that section ships as a separate chunk and only downloads when the trigger fires.

```html
@defer (on viewport) {
  <app-heavy-chart />
} @placeholder {
  <p>Chart loads when you scroll to it.</p>
} @loading {
  <app-spinner />
}
```

This is one of Angular's best performance features and it is a template block, not an infrastructure project. Use it for charts, maps, comment threads, and anything below the fold.

> **A small syntax note that trips people up.** Block syntax needs to be on its own, and `@` inside a template (like in an email address) must be escaped as `&#64;`. The CLI's migration handles this for existing code.

---

## Part 5 — Signals: How Data Flows

Signals deserve their own part because they are the concept that most changed how Angular is written.

### 5.1 Reading and writing

```ts
import { signal } from '@angular/core';

const count = signal(0);     // create, with an initial value
count();                     // read: call it
count.set(5);                // replace the value
count.update((n) => n + 1);  // change based on the current value
```

There is deliberately no `mutate()`. You replace values rather than editing them in place, which makes changes easier to track.

### 5.2 Deriving a value: `computed()`

A computed signal is calculated from other signals and updates when they do. It memoises, so it only recalculates when something it depends on actually changes.

```ts
const price = signal(20);
const quantity = signal(3);
const total = computed(() => price() * quantity());  // 60

quantity.set(4);
total();  // 64, recalculated because quantity changed
```

Use `computed()` for anything derived: totals, filtered lists, formatted labels, validity. It keeps derived state from drifting out of sync with its sources.

### 5.3 Reacting: `effect()`

An effect runs code when the signals it reads change. It is for side effects — syncing with a non-Angular library, writing to `localStorage`, logging — and it is the tool of last resort, because most things you want can be a `computed()` instead.

```ts
effect(() => {
  localStorage.setItem('theme', theme());
});
```

> **Reach for `computed()` before `effect()`.** If you find yourself using an effect to keep one piece of state in sync with another, it is usually a computed signal in disguise, and the computed version cannot fall out of sync.

### 5.4 Why this matters

When a template reads a signal, Angular remembers that connection. Change the signal, and Angular knows exactly which part of the page to update — nothing else. That precision is what lets the framework drop Zone.js entirely: it no longer has to watch every event "just in case."

> **Observables are not gone.** Angular still uses RxJS Observables in places, especially around HTTP when you want streaming or complex event handling. The modern bridge is `toSignal()`, which turns an Observable into a signal so the rest of your code can stay in signal-land. For a beginner, treat signals as the default and Observables as something you reach for later.

---

## Part 6 — Services and Dependency Injection

### 6.1 Why services exist

A component should draw a piece of screen. Logic that is not about one piece of screen — fetching products, holding the cart, formatting money — belongs in a service that many components share. Putting it in a service also makes it testable in isolation.

### 6.2 Creating one

```bash
ng generate service cart
```

```ts
import { Service, signal, computed } from '@angular/core';

@Service()                          // Angular 22 shorthand
export class CartService {
  private items = signal<string[]>([]);
  readonly count = computed(() => this.items().length);

  add(item: string) {
    this.items.update((list) => [...list, item]);
  }
}
```

The `@Service()` decorator is new in Angular 22 and is a short form of `@Injectable({ providedIn: 'root' })`. "Provided in root" means Angular makes exactly one instance for the whole app and makes it available everywhere, without further setup. That single-shared-instance behaviour is why services are the natural home for shared state.

> **Classic versus modern.** Older and current code both use `@Injectable({ providedIn: 'root' })`, and it is not going away. `@Service()` is the newer, shorter form that also marks the class as a root singleton. There is one boundary worth knowing: `@Service()` supports `inject()` but not constructor-based dependency injection, and it does not take `useClass` / `useValue` / `useFactory` provider keys. If you need any of those, keep using `@Injectable`. For a beginner writing services with `inject()`, `@Service()` is the tidier default.

### 6.3 Using one

```ts
import { Component, inject } from '@angular/core';
import { CartService } from './cart.service';

@Component({
  selector: 'app-cart-badge',
  template: `<span>{{ cart.count() }} items</span>`,
})
export class CartBadge {
  cart = inject(CartService);      // one line: ask, and receive
}
```

`inject()` is the modern way to get a dependency. It works in a component's field initialisers, in a service, and in functions that run in an "injection context", which is Angular's term for a place where asking is legal.

### 6.4 The mental picture

```
   You write:        cart = inject(CartService)
   Angular does:     "Do I already have a CartService instance?"
                       yes → hand it over
                       no  → create one, remember it, hand it over

   Because it is provided in root, every component that asks
   gets the SAME instance. That is how the cart count in the
   header and the cart page agree with each other.
```

---

## Part 7 — Routing: Many Pages, One App

### 7.1 Declaring routes

Routes are a list mapping a URL path to a component.

```ts
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home') },
  { path: 'products', loadComponent: () => import('./products/products') },
  { path: 'products/:id', loadComponent: () => import('./product-detail/product-detail') },
  { path: '**', loadComponent: () => import('./not-found/not-found') },
];
```

`loadComponent` fetches that page's code only when the route is visited, which keeps the first download small. The `:id` in `products/:id` is a route parameter — a value read from the URL. The `**` route catches everything unmatched, which is your 404 page.

### 7.2 The outlet and the links

Somewhere in your root component sits the marker where pages appear:

```html
<header>
  <nav>
    <a routerLink="/">Home</a>
    <a routerLink="/products">Products</a>
  </nav>
</header>

<router-outlet />
```

`routerLink` navigates without a full page reload. `<router-outlet />` is the hole the router fills with whichever component matches the current URL.

### 7.3 Reading route parameters

```ts
import { Component, inject, input } from '@angular/core';

@Component({ /* … */ })
export class ProductDetail {
  // with router input binding enabled, the :id maps straight to this input
  id = input.required<string>();
}
```

When you turn on component input binding (`withComponentInputBinding()`) in your router config, route parameters, query parameters, and static route data are delivered to your component as inputs — no manual subscription to the route object. It is another place where the modern API removes boilerplate you would once have written by hand.

```ts
// app.config.ts
providers: [provideRouter(routes, withComponentInputBinding())]
```

### 7.4 The shape of a real app

```
   /                  →  Home                (loaded eagerly: the landing page)
   /products          →  ProductList          (lazy)
   /products/:id      →  ProductDetail        (lazy, reads :id)
   /cart              →  CartPage             (lazy)
   /admin/**          →  AdminSection         (lazy, behind a guard)
   **                 →  NotFound             (catch-all)
```

Guidance that holds up: load the landing page eagerly, and make everything else lazy. A guard is a function that can block or redirect a navigation — the usual use is "you must be signed in for `/admin`".

---

## Part 8 — Forms: Collecting Input

Forms are where beginners usually feel Angular's weight, so here is the short version of the decision.

### 8.1 The three approaches

| Approach | Where it stands in Angular 22 | Use it when |
|---|---|---|
| **Signal Forms** | New and stable in v22 | New apps built on signals |
| **Reactive forms** | Long-standing, fully supported | Existing apps, complex validation |
| **Template-driven forms** | Simple, still supported | Tiny forms, quick prototypes |

Signal Forms were introduced as experimental in Angular 21 and became stable in Angular 22. The idea: you keep your form data in a signal, and Angular derives the form structure and validation from it.

```ts
import { form, required, email } from '@angular/forms/signals';

login = form(
  { email: '', password: '' },
  (schema) => {
    required(schema.email);
    email(schema.email);
    required(schema.password);
  }
);
```

```html
<form>
  <input [formField]="login.email" />
  @if (login.email().invalid() && login.email().touched()) {
    @for (error of login.email().errors(); track error.kind) {
      <p>{{ error.message }}</p>
    }
  }
</form>
```

One directive, `[formField]`, handles the binding. Validation rules are declared once in a schema and run automatically as values change, and each field exposes its state as signals — `value()`, `valid()`, `invalid()`, `touched()`, and `errors()`.

### 8.2 Which to choose

If you are starting fresh on Angular 22, **Signal Forms** are the natural fit and are what the documentation now teaches. If you are joining a codebase that already uses **reactive forms**, stay there — they work, they are supported, and there is a compatibility layer (`@angular/forms/signals/compat`) so you can migrate gradually rather than all at once.

> **Do not learn all three at once.** Learn one. The concepts of value, validity, touched, and error are the same in all of them; only the syntax differs.

---

## Part 9 — Talking to a Server

### 9.1 The modern way: `httpResource`

`httpResource` makes a request and hands you the result, the loading state, and the error as signals. Because it is reactive, it re-runs when the signals it depends on change, and cancels an in-flight request if a new one starts.

```ts
import { Component, input } from '@angular/core';
import { httpResource } from '@angular/common/http';

@Component({ /* … */ })
export class ProductDetail {
  id = input.required<string>();

  product = httpResource(() => `/api/products/${this.id()}`);
}
```

```html
@if (product.isLoading()) {
  <app-spinner />
} @else if (product.error()) {
  <p>Could not load that product.</p>
} @else {
  <h1>{{ product.value().name }}</h1>
}
```

Notice how the `@if` blocks read the resource's own signals. Data fetching, loading, and error states all arrive through the same mechanism, so you rarely hand-roll a "is loading" flag again.

### 9.2 When you need `HttpClient` directly

`httpResource` is for reads — fetching data to display. For writes (POST, PUT, DELETE) and for more involved cases, use `HttpClient`, which returns an Observable.

```ts
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class ProductService {
  private http = inject(HttpClient);

  createProduct(product: NewProduct) {
    return this.http.post('/api/products', product);
  }
}
```

A useful line to remember: **`httpResource` for reads, `HttpClient` for writes.** In Angular 22, the HTTP client uses the browser's Fetch API under the hood, and you only need to register `provideHttpClient()` when you are configuring something like interceptors.

> **Interceptors**, mentioned above, are functions that can see and modify every outgoing request — adding an auth header, for example. You will meet them once you have an API to secure; you do not need them on day one.

---

## Part 10 — Styling and the Component Ecosystem

### 10.1 Component styles are scoped

Styles written in a component's stylesheet apply only to that component's template. Two components can both style `.title` and they will not collide. This is one of Angular's quieter wins: you stop inventing class-name prefixes to avoid clashes.

```ts
@Component({
  selector: 'app-card',
  template: `<div class="card">…</div>`,
  styles: `
    .card { border: 1px solid #ddd; border-radius: 8px; }
  `,
})
export class Card {}
```

Global styles still live in `styles.css`. For everything else, keep styles beside the component.

### 10.2 Three ways to get components you did not write

| Package | What it gives you | Choose it when |
|---|---|---|
| **Angular Material** | Ready-made, styled components | You want a finished look fast |
| **Angular CDK** | Behaviour with no styling | You have your own design system |
| **Angular Aria** | Headless accessible patterns | You want correct keyboard and ARIA behaviour, styled your way |

**Angular Aria** became stable in Angular 22 after a preview in 21. It provides the hard parts of complex widgets — a combobox, a menu, tabs, an accordion, a toolbar — including keyboard interactions, focus management, and ARIA attributes, while leaving the visuals to you. If you were dreading building an accessible dropdown from scratch, this is the package that does it for you.

### 10.3 Images

Angular ships an image directive that enforces good defaults:

```html
<img ngSrc="hero.jpg" width="800" height="400" priority />
```

`NgOptimizedImage` (imported from `@angular/common`) requires width and height so the page does not jump while loading, lazy-loads images by default, and — with the `priority` attribute — makes the main image load first. One attribute for the hero image is often the single easiest performance win on a page.

---

## Part 11 — Performance and Rendering, Without the Deep Dive

You do not need to optimise on day one. What you should know is that the defaults are already good, and here is what each one means.

| Default | What it means in plain terms |
|---|---|
| **No Zone.js** | Angular updates by tracking signals, not by watching every browser event |
| **`OnPush` by default** | Components re-render when their data actually changes, not on every event |
| **`@defer`** | You can push heavy sections out of the first download with one template block |
| **Server-side rendering** | The CLI can render pages on the server for faster first paint |
| **Incremental hydration** | On SSR pages, only the parts the user touches become interactive first |

Two of these deserve a sentence. **Server-side rendering (SSR)** means the first HTML arrives already rendered, so users see content before the JavaScript loads; the CLI wires it up through `@angular/ssr` (`ng add @angular/ssr`). **Hydration** is the step where that server-rendered HTML becomes interactive on the client, enabled with `provideClientHydration()`. In Angular 22, incremental hydration is the default as soon as you use that provider — and it turns on event replay for you, so clicks made before the page is interactive are queued and replayed rather than lost. You can opt out with `withNoIncrementalHydration()`.

> **You do not need SSR to learn Angular.** It is valuable for public-facing sites and a distraction for a first project. Add it when you have something to optimise.

---

## Part 12 — Testing and the Developer Toolchain

### 12.1 Testing

New Angular projects use **Vitest** as the unit test runner — the CLI switched to it, and it replaced Karma and Jasmine. You write tests the same conceptual way you always have: create the component, interact with it, assert on what happened.

```ts
import { TestBed } from '@angular/core/testing';
import { Counter } from './counter';

it('increments when the button is clicked', async () => {
  const fixture = TestBed.createComponent(Counter);
  fixture.detectChanges();

  fixture.componentInstance.increment();
  await fixture.whenStable();

  expect(fixture.componentInstance.count()).toBe(1);
});
```

```bash
ng test
```

### 12.2 The tools around you

| Tool | What it does |
|---|---|
| **Angular Language Service** | Type-checking and autocomplete inside templates, in your editor |
| **Angular DevTools** | A browser extension that shows the component tree and signal values |
| **`ng update`** | Runs the official migrations when you move to a new version |
| **AI prompt rules** | `ng new` can generate configuration that teaches AI tools your project's conventions |

> **Turn on the Angular Language Service.** It is the difference between template errors that appear as you type and template errors that appear when you run the app. It is a five-minute install and it pays for itself immediately.

---

## Part 13 — How It All Fits Together

Here is one small app, traced through every piece, so you can see the wiring instead of the parts.

```
   A PRODUCT LIST APP, PIECE BY PIECE

   1. URL  /products  is visited
        →  the Router matches the route and lazy-loads ProductList

   2. ProductList  imports  ProductCard  so it can use <app-product-card>
        →  components compose into a tree

   3. ProductList  calls  inject(ProductService)
        →  Dependency Injection supplies the shared service instance

   4. ProductService  exposes  products = httpResource(() => '/api/products')
        →  a request goes out; the resource reports value, loading, error

   5. The template reads  products.value()
        →  Angular records the signal dependency

   6. @if / @for  render a card per product
        →  @for with track keeps the list fast; @empty handles zero results

   7. Clicking a card  emits an output  →  Router navigates to /products/:id
        →  ProductDetail reads :id as an input  →  fetches that one product

   8. The whole page can sit behind @defer
        →  its code loads only when it is needed
```

Every concept in this guide appears in that list exactly once. That is not a coincidence — Angular is a small number of ideas applied consistently.

---

## Cheat Sheet

```bash
# ─── CLI ────────────────────────────────────────────────────────────
ng new my-app                 # create a project
ng serve --open               # run locally, live reload
ng g c product-card           # generate a component
ng g s cart                   # generate a service
ng g guard auth               # generate a route guard
ng build                      # build to dist/
ng test                       # unit tests (Vitest)
ng update @angular/core       # upgrade with migrations
```

```ts
// ─── COMPONENT ──────────────────────────────────────────────────────
@Component({
  selector: 'app-card',
  imports: [OtherComponent],        // what this component needs
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  name = input.required<string>();   // data in
  saved = output<boolean>();         // data out
  value = model('');                 // two-way
  count = signal(0);
  total = computed(() => this.count() * 2);
  private cart = inject(CartService);
}
```

```ts
// ─── SERVICE ────────────────────────────────────────────────────────
@Service()
export class CartService {
  private items = signal<string[]>([]);
  readonly count = computed(() => this.items().length);
  add(item: string) { this.items.update((l) => [...l, item]); }
}
```

```ts
// ─── ROUTING ────────────────────────────────────────────────────────
export const routes: Routes = [
  { path: '', loadComponent: () => import('./home/home') },
  { path: 'products/:id', loadComponent: () => import('./detail/detail') },
  { path: '**', loadComponent: () => import('./not-found/not-found') },
];
```

```ts
// ─── DATA ───────────────────────────────────────────────────────────
product = httpResource(() => `/api/products/${this.id()}`);
// read: product.value() · product.isLoading() · product.error()
```

```html
<!-- ─── TEMPLATE ─────────────────────────────────────────────────── -->
{{ value }}                         <!-- print -->
[disabled]="!valid()"               <!-- bind in -->
(click)="save()"                    <!-- listen -->
[(value)]="name"                    <!-- two-way -->

@if (user()) { … } @else { … }
@for (p of products(); track p.id) { … } @empty { … }
@switch (status()) { @case ('a') { … } @default { … } }

@defer (on viewport) { … } @placeholder { … } @loading { … }
```

| I want to… | Use |
|---|---|
| Create a project | `ng new` |
| Add a file | `ng generate` |
| Draw a piece of UI | A component |
| Hold a value | `signal()` |
| Derive a value | `computed()` |
| React to a change | `effect()` |
| Share logic | A service + `inject()` |
| Pass data to a child | `input()` |
| Send an event to a parent | `output()` |
| Two-way bind | `model()` |
| Conditionally show | `@if` |
| Repeat a list | `@for` (with `track`) |
| Map a URL to a page | A route + `loadComponent` |
| Fetch data to display | `httpResource` |
| Send data to the server | `HttpClient` |
| Collect form input | Signal Forms |
| Defer heavy content | `@defer` |
| Optimise the hero image | `NgOptimizedImage` + `priority` |
| Accessible widgets | Angular Aria |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| A component tag does nothing | Not in the `imports` array | Import it in the `@Component` decorator |
| `NG8001` in the editor or console | Unknown element — usually a missing import | Add the component, directive, or pipe to `imports` |
| `input.required()` is undefined at runtime | The parent did not pass it | Check the `[prop]="…"` binding in the parent template |
| `@for` warns about tracking | Missing `track` | Add `track item.id` with a stable unique property |
| A signal never updates the page | You read `count` instead of `count()` | Signal values are read by calling them |
| `inject()` throws "not in an injection context" | Called outside a constructor or field initialiser | Move it to a field initialiser, or run inside the allowed context |
| Effect runs forever | It sets the same signal it reads | Use `computed()`, or read without tracking |
| Route shows nothing | No `<router-outlet />` | Add the outlet where the page should render |
| Deep link 404s after deploy | Server not rewriting to `index.html` | Configure the host to serve the app shell for unknown paths |
| `@` in a template breaks the build | Unescaped `@` in content | Write `&#64;` |
| Form value does not appear | Binding the wrong directive | Signal Forms use `[formField]`; check the schema path |
| `httpResource` fires too often | The URL function reads a signal that changes a lot | Debounce the input signal, or narrow the dependency |
| Tests fail to import a component | Missing test setup for that dependency | Provide the dependency in `TestBed` |
| Build fails on an old tutorial | Old API (NgModule, `*ngIf`) | Follow the current docs; the migrations can rewrite most of it |
| Upgrade errors on TypeScript | Angular 22 needs TS `>=6.0 <6.1` | Update TypeScript, then `ng update` |
| `zone.js` still in the bundle | Old project, polyfills not cleaned | Remove `zone.js` from the build and `npm uninstall zone.js` |

---

## Video Library

YouTube **search** links only — a version-specific video goes stale with the next release.

| Search | What you'll find |
|---|---|
| [Angular tutorial for beginners 2026](https://www.youtube.com/results?search_query=Angular+tutorial+for+beginners+2026) | Starting from zero |
| [Angular signals tutorial](https://www.youtube.com/results?search_query=Angular+signals+tutorial) | `signal`, `computed`, `effect` in practice |
| [Angular standalone components](https://www.youtube.com/results?search_query=Angular+standalone+components) | The modern component model |
| [Angular control flow @if @for](https://www.youtube.com/results?search_query=Angular+control+flow+%40if+%40for) | The new template blocks |
| [Angular dependency injection inject()](https://www.youtube.com/results?search_query=Angular+dependency+injection+inject+function) | Services and DI |
| [Angular router tutorial](https://www.youtube.com/results?search_query=Angular+router+tutorial+lazy+loading) | Routes and lazy loading |
| [Angular signal forms](https://www.youtube.com/results?search_query=Angular+signal+forms) | Forms on signals |
| [Angular httpResource](https://www.youtube.com/results?search_query=Angular+httpResource) | Reactive data fetching |
| [Angular zoneless change detection](https://www.youtube.com/results?search_query=Angular+zoneless+change+detection) | Why Zone.js is gone |
| [Angular SSR and hydration](https://www.youtube.com/results?search_query=Angular+SSR+hydration) | Server rendering and hydration |

---

## Written References & Docs

The official documentation is unusually good for Angular, and it is the source that keeps up with the framework. Start there.

| Source | URL |
|---|---|
| Angular documentation home | `https://angular.dev/` |
| Essentials — a short tour of the concepts | `https://angular.dev/essentials` |
| Learn Angular — interactive tutorial | `https://angular.dev/tutorials/learn-angular` |
| Your first app — the fuller tutorial | `https://angular.dev/tutorials/first-app` |
| Components — anatomy | `https://angular.dev/guide/components` |
| Templates — binding and control flow | `https://angular.dev/guide/templates/control-flow` |
| Signals — overview | `https://angular.dev/guide/signals` |
| Dependency injection — overview | `https://angular.dev/guide/di` |
| Creating and using services | `https://angular.dev/guide/di/creating-and-using-services` |
| Routing — lazy loading | `https://angular.dev/guide/routing/loading-strategies` |
| Routing — route data as component inputs | `https://angular.dev/api/router/withComponentInputBinding` |
| Forms — signal forms overview | `https://angular.dev/guide/forms/signals/overview` |
| Forms — field state management | `https://angular.dev/guide/forms/signals/field-state-management` |
| `httpResource` | `https://angular.dev/guide/http/http-resource` |
| Zoneless change detection | `https://angular.dev/guide/zoneless` |
| Hydration | `https://angular.dev/guide/hydration` |
| Incremental hydration | `https://angular.dev/guide/incremental-hydration` |
| Angular Aria — overview | `https://angular.dev/guide/aria/overview` |
| Accessibility best practices | `https://angular.dev/best-practices/a11y` |
| Image optimization | `https://angular.dev/guide/image-optimization` |
| Style guide (file naming) | `https://angular.dev/style-guide` |
| Migrating from Karma to Vitest | `https://angular.dev/guide/testing/migrating-to-vitest` |
| CLI reference | `https://angular.dev/cli` |
| Versioning and release schedule | `https://angular.dev/reference/releases` |
| Angular roadmap | `https://angular.dev/roadmap` |
| Official release notes (per version) | `https://github.com/angular/angular/releases` |
| Update guide | `https://angular.dev/update-guide` |

**Third-party, useful but not the source of truth:**

| Source | Why |
|---|---|
| Release walkthrough blogs | Good summaries of what a version changed; verify against the release notes |
| "Best practices" listicles | Convenient checklists; some still show pre-signal patterns |
| Community tutorials | Vary widely; check the Angular version before following |

> **Verification tip:** when a tutorial contradicts `angular.dev`, the documentation wins. Angular changes its recommended approach often enough that the framework's own site is the only source that stays current.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Angular | A full web framework: UI, routing, forms, data, and build tool together |
| Component | A class plus a template plus a selector; one piece of screen |
| Template | The HTML a component renders |
| Directive | A behaviour attached to an element |
| Pipe | A function used inside a template to format a value |
| Service | A plain class holding shared logic |
| Dependency injection | The system that supplies services to whoever asks |
| `inject()` | The function that asks Angular for a dependency |
| Signal | A value that announces its own changes |
| `computed()` | A signal derived from other signals |
| `effect()` | Code that runs when the signals it reads change |
| Standalone component | A component that imports what it needs, with no module wrapper |
| Zone.js | The old change-detection watcher; no longer used by default |
| Zoneless | Change detection driven by signals rather than by events |
| OnPush | The default change-detection strategy: re-render when data changes |
| Router | The part that maps URLs to components |
| `router-outlet` | The marker where the current page renders |
| Lazy loading | Downloading a page's code only when it is visited |
| Route guard | A function that can allow or block a navigation |
| Signal Forms | Angular's signal-based form library, stable in v22 |
| Reactive forms | The long-standing model-driven form approach |
| `httpResource` | A reactive HTTP request exposing value, loading, and error |
| `HttpClient` | The core HTTP service; used for writes |
| SSR | Server-side rendering; the server sends ready-made HTML |
| Hydration | Turning server-rendered HTML into an interactive app |
| `@defer` | A template block that loads its content later |
| CLI | `ng` — the command-line tool for the whole workflow |
| Angular Aria | Headless, accessible component directives |

---

## FAQ & Next Steps

**Do I need to learn NgModules?** Not to start, and not for new code. Standalone components are the default, and they import what they need directly. You will meet NgModules in older codebases; the concepts transfer.

**Signals or RxJS?** Signals for state, and that is most of what a beginner needs. RxJS still earns its place for complex asynchronous streams, and `toSignal()` bridges the two. Do not treat them as rivals.

**Do I need to know TypeScript well?** You need classes and types, which is a day of learning. Angular's own TypeScript use is straightforward, and the editor tells you when something is wrong.

**Which version should I learn?** The current one — Angular 22 as of this writing. A major lands about once a year, and `ng update` runs the migrations, so you are not relearning the framework each time.

**Is Angular still relevant?** It is actively developed, with a yearly major, a public roadmap, and recent releases that modernised state, forms, and rendering. It is heavier than a library, and that is a deliberate trade for having the pieces agree.

**Should I use Angular Material or build my own?** Start with Material to get moving, and move to the CDK or Angular Aria when you have a design of your own. Angular Aria gives you correct behaviour without imposing a look.

**Do I need SSR to start?** No. It matters for public sites and first-paint speed. Add it later; `ng add @angular/ssr` sets it up.

**How do I know if a tutorial is current?** Look for: standalone components, `@if`/`@for`, `input()`/`output()`, signals, and no Zone.js. If it uses `*ngIf`, `@Input()`, and `NgModule` as the default, it predates the current shape.

**What is changing next?** The roadmap lists work across reactivity, forms, and tooling, and WebMCP (integrating AI agents into web apps) is available to experiment with. The direction is consistent: signals and defaults that are correct out of the box.

### Next steps, in order

1. **Today:** install the CLI, run `ng new`, and get the starter app on screen with `ng serve`.
2. **This week:** build one component with a `signal()` and a `computed()`, and pass data into it with `input()`.
3. **Next week:** add a service with `inject()` and move your state into it.
4. **Week 3:** add the router, make two lazy routes, and link between them.
5. **Week 4:** fetch real data with `httpResource` and render loading and error states.
6. **Month 2:** build a form with Signal Forms, add `@defer` to one heavy section, and run `ng test`.

---

## Verification Note

**Verified as of September 2026 against the official Angular documentation and release notes:**

- **Angular 22 is the current major**, released **3 June 2026**; the release schedule lists v22.1 (week of 2026-07-27) and v22.2 (week of 2026-09-21), with v23.0 expected around **June 2027**. Majors are supported for roughly **24 months** (active then LTS); v22 is Active until ~2027-06 with LTS until ~2028-06 (`angular.dev/reference/releases`).
- **Angular 22 requires TypeScript `>=6.0.0 <6.1.0`** and **Node.js `^22.22.0 || ^24.13.1 || >=26.0.0`**; Node 20 support was dropped (Angular 22 release coverage; `angular.dev` version compatibility).
- **Signal Forms, the Resource API (`resource`, `httpResource`), and `@angular/aria` are stable in Angular 22**; Signal Forms and Angular Aria were introduced in developer preview in Angular 21 (`angular.dev/roadmap`; Angular 22 release coverage).
- **`httpResource` is marked stable since v22.0** and is built on `HttpClient`, supporting interceptors; `provideHttpClient()` is only needed when configuring HTTP features (`angular.dev/api/common/http/httpResource`, `angular.dev/guide/http/http-resource`).
- **`HttpClient` uses the Fetch API by default in v22**, where it previously used XMLHttpRequest (Angular 22 release coverage).
- **`OnPush` is the default change-detection strategy in v22**, and `ChangeDetectionStrategy.Default` was renamed to `ChangeDetectionStrategy.Eager` (introduced in v21.2) (`angular.dev/roadmap`; the Angular RFC discussion #66779).
- **Zoneless change detection is the default from Angular v21**, stable as of **v20.2** via `provideZonelessChangeDetection()` (`angular.dev/guide/zoneless`, `angular.dev/api/core/provideZonelessChangeDetection`).
- **A new `@Service()` decorator was added in Angular 22** as an ergonomic shorthand for `@Injectable({ providedIn: 'root' })`; `@Service` supports `inject()` but not constructor-based DI (`angular.dev/guide/di/creating-and-using-services`, `angular.dev/guide/di`).
- **Control flow blocks (`@if`, `@for`, `@switch`) are available from Angular v17**, and `@for` requires a `track` expression (`angular.dev/guide/templates/control-flow`; `angular.dev/reference/migrations/control-flow`).
- **`withComponentInputBinding()`** binds query params, path and matrix params, static route data, and resolver data directly to component inputs, with documented precedence (`angular.dev/api/router/withComponentInputBinding`, `angular.dev/guide/routing/common-router-tasks`).
- **Incremental hydration is enabled by default when using `provideClientHydration()`** and enables event replay automatically; it can be opted out of with `withNoIncrementalHydration()`, and event replay can be requested with `withEventReplay()` (`angular.dev/guide/incremental-hydration`, `angular.dev/guide/hydration`, `angular.dev/api/platform-browser/provideClientHydration`).
- **Vitest is the default unit test runner for new CLI projects**, with Karma/Jasmine migration documented as experimental (`angular.dev/guide/testing/migrating-to-vitest`, `angular.dev/roadmap`).
- **Signal Forms** field state exposes `value()`, `valid()`, `invalid()`, `pending()`, `touched()`, `dirty()`, `disabled()`, `readonly()`, and `errors()`; each error carries `kind` and an optional `message` (`angular.dev/guide/forms/signals/field-state-management`, `angular.dev/api/forms/signals/FieldState`). Note that `valid()` is not the same as `!invalid()`: `valid()` requires no errors *and* no pending validators.
- **`NgOptimizedImage`** requires `width` and `height`, lazy-loads by default, and uses the `priority` attribute to prioritise the LCP image (`angular.dev/guide/image-optimization`).
- **Signal-based component APIs** — `input()`, `input.required()`, `output()`, `model()` — are the documented approach; `@Input()`/`@Output()` decorators remain supported (Angular tutorial and API docs).
- **New projects use a concise file-naming style guide** (`app.ts`, `app.html`) rather than the older type-in-name style (`app.component.ts`); the CLI's `file-name-style-guide` option selects `2025` (default) or `2016` (`angular.dev/cli/new`, `angular.dev/cli/generate/application`, `angular.dev/style-guide`).

**Where I am relying on third-party analysis rather than a primary source:** the per-release feature summaries and the "Angular 22 is here" details (for example the exact list of additions such as the `debounced()` function, `injectAsync()`, HTML comments in templates, and the deprecation of the Webpack-based builders) come from well-known community release write-ups, not from a single vendor page. The roadmap and API documentation confirm the headline status changes; the smaller items are labelled by their source.

**Vendor and third-party claims, not independently verified:** exact release dates are approximate in Angular's own schedule ("week of", "~ Month"), and community blogs differ slightly on the specific day the CLI switched defaults. Compatibility of any third-party library with Zoneless or OnPush is not covered here.

**Changes fast:** Angular ships a major roughly annually and minors every couple of months, and defaults have shifted several times in the last three years (standalone, zoneless, OnPush, test runner). Re-check `angular.dev/reference/releases` and the roadmap before depending on any status in this guide.

**Not a substitute for the official docs.** This is an orientation guide; the Angular documentation is the authority, and it is maintained alongside each release.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd start, given the rest of the shelf.**

| In my workspace | Verdict |
|---|---|
| VS Code | Install the Angular Language Service — it type-checks templates as you type |
| A terminal | `ng` for everything; no separate bundler or dev-server config |
| AI coding agents | `ng new` can generate AI prompt rules so an agent follows the project's conventions |
| An existing React/Vue habit | Expect to un-learn manual change tracking; signals handle it |
| A design system | Use Angular Aria or the CDK for behaviour, and bring your own styles |
| A public-facing site | Add SSR with `ng add @angular/ssr` once the app works |

**Recommended setup:**

- **Start with the official tutorial, not a video.** `angular.dev/tutorials/learn-angular` is interactive and stays current; most videos do not.
- **Turn on the Language Service first.** It catches missing imports and template mistakes immediately.
- **One component, one job.** If a component is fetching data *and* rendering *and* validating a form, split it.
- **Logic in services, data in signals.** Components read; services own. That split is what makes both testable.
- **`computed()` before `effect()`.** Reach for an effect only when nothing reactive fits.
- **Learn one form approach.** Signal Forms for new work, reactive forms if the codebase already uses them.
- **`inject()` over constructor injection.** It is shorter and works in more places.
- **What I would not do:** read a 2020-era tutorial and follow it verbatim. Check for signals and standalone components before trusting a guide.

**Smoke test for the first session, in order:**

```bash
# 1. do I have a supported Node?
node --version        # expect v22.22+, v24.13.1+, or v26+

# 2. the CLI
npm install -g @angular/cli
ng version

# 3. a project that runs
ng new my-app
cd my-app
ng serve --open       # should open http://localhost:4200

# 4. a component, generated not typed
ng g c hello
# then add <app-hello /> to src/app/app.html and watch it appear
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, works across the web stack, uses opencode and AI coding agents
daily, and learns by doing. He is new to Angular and wants orientation, not internals.

Paper: markdown_docs/20-angular-beginners-guide.md
Topic: Learning Angular from scratch in 2026 — Angular 22's components, signals, services and
DI, routing, forms, data fetching, styling, performance defaults, and testing, explained as
"this does this, it connects to this".

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler. Keep it beginner-friendly: explain
what each piece is for before showing syntax, and connect each piece to the next.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (a full small app built step by step; Angular Material vs CDK vs
Angular Aria; migrating an old NgModule/Zoneless codebase to v22; testing patterns with
Vitest; SSR and incremental hydration in depth); (C) take his real project and convert one
page to the modern shape — read the code, list the legacy patterns, and rewrite them.

Rules: never invent a version number, release date, API name, or stability status. Check
angular.dev/reference/releases, the roadmap, and the relevant guide page before asserting any
of it. Say plainly which pieces are stable and which are still experimental. Distinguish
primary sources (angular.dev, the Angular repo release notes) from community summaries. Label
any third-party claim. Keep the structure. Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://angular.dev/essentials
https://angular.dev/guide/signals
https://angular.dev/guide/di
https://angular.dev/guide/forms/signals/overview
https://angular.dev/guide/http/http-resource
https://angular.dev/reference/releases
```
