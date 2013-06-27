var Monitor = {
	view: {
		dashboard: {
			displayStats: function(data) {
				//Display the system information
				var $system = $(".system");
				$system.html(Mustache.render($system.html(), {
					hostname: data.system_info.hostname,
					process_count: (data.processes) ? data.processes.length : 0,
					cpu_count: (data.monit.cpu) ? data.monit.cpu.length : 0,
					load_avg: (function() {
						//convert the load averages to strings and cap at two decimal places
						return data.monit.loadavg.map(function(v) { return v.toString().replace(/(\.\d\d).+/, "$1"); });
					})(),
					uptime: moment.duration(data.system_info.uptime, "seconds").humanize(),
					memory_free_percent: (data.monit.free_mem/data.monit.total_mem) * 100,
					memory_used_percent: 100 - ((data.monit.free_mem/data.monit.total_mem) * 100)
				}));
			},

			displayProcesses: function(data) {
				//Since we dont need to keep
				$(".list").html(Mustache.render(Monitor.view.template("process-list"), {
					processes: data.processes,
					uptime: function() {
						return moment.duration(this.opts.pm_uptime - Date.now()).humanize()
					},

					_class: function() {
						if(this.opts.name.match(/Pm2Http/)) return "self";
						else return false;
					}
				}));

				//Bind the events
				setTimeout(function() {
					$(".process").each(function() {
						$(this).on("click", function() {
							console.log("Going to show process log! Soon!");
						})
					})
				}, 50);
			},

			//This whole thing isn't ideal
			interval: 4000,
			timeout: false,
			refresh: function(callback) {
				var dash = Monitor.view.dashboard;
				if(dash.timeout) clearTimeout(dash.timeout);

				var bar = $(".refresh-bar div div");
				bar.css("-webkit-animation", "none")
				setTimeout(function() {
					bar.css("-webkit-animation", "progress " + dash.interval + "ms");
				}, 30);

				callback();

				dash.timeout = setTimeout(function() { dash.refresh(callback) }, dash.interval)
			}
		},

		loading: {
			show: function() {

			},

			hide: function() {

			}
		},

		template: function(name) {
			return $("#" + name).text();
		}
	},

	model: {
		info: {
			get: function(callback) {
				//Phew, it's been a while since I've used a library
				//The simplicity here is refreshing.
				$.getJSON("/api", function(data) {
					callback(data);
				});
			}
		},

		log: {
			get: function(type, pid) {

			}
		}
	},

	controller: {
		dashboard: function() {

			function refresh() {
				Monitor.model.info.get(function(data) {
					Monitor.view.dashboard.displayStats(data);
					Monitor.view.dashboard.displayProcesses(data);
				});
			}
			
			$("#refresh").on("click", function(event) {
				Monitor.view.dashboard.refresh(refresh);
			});

			$("#refresh-interval").on("keydown", function(event) {
				var $this = $(this),	
					val = parseInt($this.val());

				if(val) Monitor.view.dashboard.interval = val * 1000;
				else {
					if($(this).val() !== "") $(this).val(Monitor.view.dashboard.interval/1000);
				}				
			})

			Monitor.view.dashboard.refresh(refresh);
		}
	},

	init: function() {
		//MVC style for future expansions
		Monitor.controller.dashboard();
	}
};

Monitor.init();