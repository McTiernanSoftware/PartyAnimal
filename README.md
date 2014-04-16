PartyAnimal
===========

A tool for scale testing web services by mimicking user behaviors. Originally,
this tool was used specifically for testing the Yahoo!7 FANGO APIs and the
receivers would run various scripts that mimicked their user archetypes ("power
user", "chatterbug", etc.). The scripts would register a new account, browse
for a TV show to watch, check into it, and begin playing games and chatting.
That highly specific behavior has been stripped down for the purpose of
clarity and concision.


Why Did You Build This?
-----------------------

Yahoo!7 FANGO is hosted on Amazon Web Services and relies on Elastic Load
Balancers to spread load across the 8+ app server instances. The tricky thing
about Elastic Load Balancers (or ELBs) is that they're actually quite limited
in terms of how many requests they can handle *unless* the ELB has been primed
beforehand. Once your ELB has received enough requests, AWS will automatically
provision more resources to your ELB, but it takes a considerable amount of
time. Using the existing tools and frameworks on the market, I couldn't find
anything that would let us gradually scale up our load/scale test over time.
PartyAnimal lets developers specify a maximum number of workers to run after
a specified duration and the listeners will gradually roll out over the given
timeframe.

Additionally, we wanted to be able to "accurately" project how many users the
infrastructure could support. Instead of our primary metric being "requests"
per second, we could provide a fairly definitive answer as to how many actual
users we could support simultaneously as well as how well the system could
respond to spikes (by setting high workers / low durations). PartyAnimal can
do all of that.


How It Works
------------

PartyAnimal has two main pieces: the Director script and the Receiver script.
The Director sends instructions via PubNub for how a scale test should be
performed. The Receiver scripts respond to those instructions by spinning up
"user" scripts that run a set of steps in a loop in a way that mimics user
behavior.


The Director
------------

You can run the director like so:

    node director.js

And you'll be presented with a REPL console. From here, you can do a number of
different things:

----------------------------------------

**Set the Type of Script to Run**

    PartyAnimal> director.scriptType = "default";

**Set the Desired Number of Workers**

    PartyAnimal> director.workers = 1024;

**Set the Duration of the Worker Roll-out**

    PartyAnimal> director.duration = 600;

**Set the Delay Before Rolling Out the Test**

    PartyAnimal> director.delay = 30;

**Retrieve the Number of Active Receivers**

    PartyAnimal> director.discover();

**Ping the Active Receivers**

    PartyAnimal> director.ping();

**Start the Test**

    PartyAnimal> director.start();

Alternatively:

    PartyAnimal> director.start({"scriptType": "poweruser", "workers": 512, "duration": 60, "delay": 0});

**Stop the Test**

    PartyAnimal> director.stop();

-----------------------------------------

Prior to running the test, it's important to run `director.discover()` to get
a count of active receivers. Receivers are fully autonomous and therefore, they
aren't aware of how many other receivers are running. The director needs to
retrieve an accurate count of receivers in order to divide the total number of
workers evenly among all of the receivers.


The Receiver
------------

The Receiver script listens for instructions from the Director and then loads
the specified script from the `./scripts` directory and rolls it out gradually
over the specified duration. When run from the command line, the Receiver will
automatically form a cluster of Receivers equal to the number of CPUs on the
host machine.

Usage is very straightforward. Simply run `node receiver.js` from the command
line and it's up and running.

When working with a cloud-based host, it's a good idea to create a simple
upstart script that loads `receiver.js` on start-up. That way, you can create
a server image and launch any number of receiver servers you so desire.


Reports
-------

The Receiver script will send back very basic reports that include the number
of successful requests, the number of failed requests, and the total time to
complete the requests. The Director will print these to STDOUT as well as write
them to `./results.log`.
